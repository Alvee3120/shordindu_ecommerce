from django.db import connection, transaction
from django.db.models import Max
from django.http import Http404
from rest_framework import generics, permissions
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AnnouncementBar, CampaignBanner, HeroBanner, HeroBannerSettings
from .permissions import IsAdminOnly
from .serializers import (
    AnnouncementBarAdminSerializer,
    CampaignBannerAdminSerializer,
    HeroBannerAdminSerializer,
    HeroBannerReorderSerializer,
    HeroBannerSettingsSerializer,
    PublicAnnouncementBarSerializer,
    PublicCampaignBannerSerializer,
    PublicHeroBannerSerializer,
)


class HealthView(APIView):
    """Readiness probe used by the deploy pipeline's smoke test."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        connection.ensure_connection()
        return Response({"status": "ok"})


class PublicAnnouncementBarView(APIView):
    """The announcement strip to show, or inactive when disabled/empty."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        bar = AnnouncementBar.load()
        if not bar.is_live:
            return Response({"active": False, "announcement": None})
        return Response(
            {"active": True, "announcement": PublicAnnouncementBarSerializer(bar).data}
        )


class AnnouncementBarManageView(APIView):
    """Admin-only read/update of the single announcement strip."""

    permission_classes = [IsAdminOnly]

    def get(self, request):
        return Response(AnnouncementBarAdminSerializer(AnnouncementBar.load()).data)

    def put(self, request):
        return self._update(request, partial=False)

    def patch(self, request):
        return self._update(request, partial=True)

    def _update(self, request, partial):
        serializer = AnnouncementBarAdminSerializer(
            AnnouncementBar.load(), data=request.data, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        return Response(serializer.data)


class PublicCampaignBannersView(APIView):
    """The campaign banners the homepage should show right now, by slot.

    Disabled, scheduled-in-the-future and expired banners are omitted so
    unpublished campaign content is never exposed.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        banners = [banner for banner in CampaignBanner.objects.order_by("slot") if banner.is_live]
        return Response(
            {
                "banners": PublicCampaignBannerSerializer(
                    banners, many=True, context={"request": request}
                ).data
            }
        )


class CampaignBannersManageView(APIView):
    """Admin-only list of every banner slot's configuration."""

    permission_classes = [IsAdminOnly]

    def get(self, request):
        banners = CampaignBanner.objects.order_by("slot")
        return Response(
            CampaignBannerAdminSerializer(
                banners, many=True, context={"request": request}
            ).data
        )


class CampaignBannerManageView(APIView):
    """Admin-only read/update of one banner slot (created if it doesn't exist)."""

    permission_classes = [IsAdminOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    VALID_SLOTS = {CampaignBanner.Slot.AFTER_CATEGORIES, CampaignBanner.Slot.BEFORE_MEN}

    def _banner(self, slot):
        if slot not in self.VALID_SLOTS:
            raise Http404
        return CampaignBanner.load(slot)

    def get(self, request, slot):
        banner = self._banner(slot)
        return Response(CampaignBannerAdminSerializer(banner, context={"request": request}).data)

    def put(self, request, slot):
        return self._update(request, slot, partial=False)

    def patch(self, request, slot):
        return self._update(request, slot, partial=True)

    def _update(self, request, slot, partial):
        banner = self._banner(slot)
        serializer = CampaignBannerAdminSerializer(
            banner, data=request.data, partial=partial, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        return Response(serializer.data)


class PublicHeroBannersView(APIView):
    """Active homepage hero slides, in display order, plus carousel settings."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        banners = HeroBanner.objects.filter(is_active=True).order_by("sort_order", "id")
        settings = HeroBannerSettings.load()
        return Response(
            {
                "banners": PublicHeroBannerSerializer(
                    banners, many=True, context={"request": request}
                ).data,
                "autoplay_delay_ms": settings.autoplay_delay_ms,
            }
        )


class HeroBannerListCreateView(generics.ListCreateAPIView):
    """Admin-only list of every hero banner (including inactive) and create."""

    permission_classes = [IsAdminOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    serializer_class = HeroBannerAdminSerializer
    pagination_class = None

    def get_queryset(self):
        return HeroBanner.objects.select_related("updated_by").order_by("sort_order", "id")

    def perform_create(self, serializer):
        highest = HeroBanner.objects.aggregate(value=Max("sort_order"))["value"]
        next_order = 0 if highest is None else highest + 1
        serializer.save(sort_order=next_order, updated_by=self.request.user)


class HeroBannerDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    serializer_class = HeroBannerAdminSerializer
    queryset = HeroBanner.objects.select_related("updated_by")

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class HeroBannerReorderView(APIView):
    """Persist the admin's drag-and-drop order: every id must be sent once."""

    permission_classes = [IsAdminOnly]

    def post(self, request):
        serializer = HeroBannerReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.validated_data["order"]

        if len(order) != len(set(order)):
            raise ValidationError({"order": ["Banner ids must be unique."]})
        existing = set(HeroBanner.objects.values_list("id", flat=True))
        if set(order) != existing:
            raise ValidationError({"order": ["Send every banner id exactly once."]})

        with transaction.atomic():
            for index, banner_id in enumerate(order):
                HeroBanner.objects.filter(pk=banner_id).update(sort_order=index)

        banners = HeroBanner.objects.select_related("updated_by").order_by("sort_order", "id")
        return Response(
            HeroBannerAdminSerializer(banners, many=True, context={"request": request}).data
        )


class HeroBannerSettingsView(APIView):
    permission_classes = [IsAdminOnly]

    def get(self, request):
        return Response(HeroBannerSettingsSerializer(HeroBannerSettings.load()).data)

    def patch(self, request):
        settings = HeroBannerSettings.load()
        serializer = HeroBannerSettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
