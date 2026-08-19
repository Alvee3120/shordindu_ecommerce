from rest_framework import permissions, status, viewsets
from rest_framework.response import Response

from apps.core.permissions import IsOwnerOrReadOnly

from .models import Review, Wishlist
from .serializers import ReviewSerializer, WishlistSerializer


class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.all().select_related("user", "product").order_by("-created_at")
    serializer_class = ReviewSerializer
    permission_classes = [IsOwnerOrReadOnly]
    filterset_fields = ["product", "rating"]


class WishlistViewSet(viewsets.ModelViewSet):
    serializer_class = WishlistSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Wishlist.objects.filter(user=self.request.user).select_related("product", "variation")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item, created = Wishlist.objects.get_or_create(
            user=request.user,
            product=serializer.validated_data["product"],
            variation=serializer.validated_data.get("variation"),
        )
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(self.get_serializer(item).data, status=status_code)
