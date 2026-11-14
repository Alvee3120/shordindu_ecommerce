from django.db import transaction
from django.db.models import Q
from rest_framework import generics, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.core.permissions import CanManageOrders, IsAdminOnly, IsOwnerOrReadOnly, is_admin

from .models import Review, ReviewImage
from .serializers import (
    MAX_REVIEW_IMAGES,
    AdminReviewSerializer,
    ReviewSerializer,
    validate_review_image,
)


class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewSerializer
    permission_classes = [IsOwnerOrReadOnly]
    filterset_fields = ["product", "rating", "status"]

    def get_queryset(self):
        qs = (
            Review.objects.select_related("user", "product")
            .prefetch_related("images")
            .order_by("-review_date", "-created_at", "-id")
        )
        user = self.request.user
        if is_admin(user):
            return qs
        if user.is_authenticated:
            return qs.filter(Q(status=Review.Status.APPROVED) | Q(user=user))
        return qs.filter(status=Review.Status.APPROVED)

    def get_permissions(self):
        if self.action in ("approve", "reject"):
            return [IsAdminOnly()]
        return super().get_permissions()

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        review = self.get_object()
        review.status = Review.Status.APPROVED
        review.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(review).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        review = self.get_object()
        review.status = Review.Status.REJECTED
        review.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(review).data)


def _add_review_images(review, request):
    files = request.FILES.getlist("images")
    if not files:
        return
    if review.images.count() + len(files) > MAX_REVIEW_IMAGES:
        raise serializers.ValidationError(
            {"images": [f"Use at most {MAX_REVIEW_IMAGES} images."]}
        )
    for file in files:
        validate_review_image(file)
    start = review.images.count()
    for index, file in enumerate(files):
        ReviewImage.objects.create(review=review, image=file, sort_order=start + index)


def _remove_review_images(review, request):
    raw = request.data.get("remove_image_ids", "")
    if isinstance(raw, (list, tuple)):
        ids = raw
    else:
        ids = [value.strip() for value in str(raw).split(",") if value.strip()]
    if ids:
        review.images.filter(id__in=ids).delete()


class ReviewManageListCreateView(generics.ListCreateAPIView):
    """Admin/CCE review management: every review, all statuses, manual create."""

    serializer_class = AdminReviewSerializer
    permission_classes = [CanManageOrders]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ["status", "rating", "verified_purchase", "product"]
    search_fields = [
        "customer_name",
        "customer_email",
        "user__name",
        "user__email",
        "product__name",
        "title",
        "comment",
    ]
    ordering_fields = ["review_date", "rating", "created_at"]
    ordering = ["-review_date", "-created_at"]

    def get_queryset(self):
        return Review.objects.select_related("user", "product", "created_by").prefetch_related(
            "images"
        )

    def perform_create(self, serializer):
        with transaction.atomic():
            review = serializer.save(created_by=self.request.user)
            _add_review_images(review, self.request)


class ReviewManageDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AdminReviewSerializer
    permission_classes = [CanManageOrders]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return Review.objects.select_related("user", "product", "created_by").prefetch_related(
            "images"
        )

    def perform_update(self, serializer):
        with transaction.atomic():
            review = serializer.save()
            _remove_review_images(review, self.request)
            _add_review_images(review, self.request)
