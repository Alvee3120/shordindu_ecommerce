from django.db import transaction
from django.db.models import Max
from rest_framework import generics, permissions
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CampaignBanner, HeroBanner, HeroBannerSettings
from .permissions import IsAdminOnly
from .serializers import (
    CampaignBannerAdminSerializer,
    HeroBannerAdminSerializer,
    HeroBannerReorderSerializer,
    HeroBannerSettingsSerializer,
    PublicCampaignBannerSerializer,
    PublicHeroBannerSerializer,
)


class PublicCampaignBannerView(APIView):
    """The banner the homepage should show right now.

    ``{"active": false, "banner": null}`` when it's disabled or outside its
    schedule, so unpublished/upcoming campaign content isn't exposed.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        banner = CampaignBanner.load()
        if not banner.is_live:
            return Response({"active": False, "banner": None})
        data = PublicCampaignBannerSerializer(banner, context={"request": request}).data
        return Response({"active": True, "banner": data})


class CampaignBannerManageView(APIView):
    """Admin-only read/update of the single banner configuration."""

    permission_classes = [IsAdminOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        banner = CampaignBanner.load()
        return Response(CampaignBannerAdminSerializer(banner, context={"request": request}).data)

    def put(self, request):
        return self._update(request, partial=False)

    def patch(self, request):
        return self._update(request, partial=True)

    def _update(self, request, partial):
        banner = CampaignBanner.load()
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
