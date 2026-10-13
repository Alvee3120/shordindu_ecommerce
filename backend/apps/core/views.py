from rest_framework import permissions
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CampaignBanner
from .permissions import IsAdminOnly
from .serializers import CampaignBannerAdminSerializer, PublicCampaignBannerSerializer


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
