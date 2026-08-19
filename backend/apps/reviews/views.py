from rest_framework import viewsets

from apps.core.permissions import IsOwnerOrReadOnly

from .models import Review
from .serializers import ReviewSerializer


class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.all().select_related("user", "product").order_by("-created_at")
    serializer_class = ReviewSerializer
    permission_classes = [IsOwnerOrReadOnly]
    filterset_fields = ["product", "rating"]
