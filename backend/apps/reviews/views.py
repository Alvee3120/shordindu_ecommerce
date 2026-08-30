from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import IsAdminOnly, IsOwnerOrReadOnly, is_admin

from .models import Review
from .serializers import ReviewSerializer


class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewSerializer
    permission_classes = [IsOwnerOrReadOnly]
    filterset_fields = ["product", "rating", "status"]

    def get_queryset(self):
        qs = Review.objects.all().select_related("user", "product").order_by("-created_at")
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
        review.save(update_fields=["status"])
        return Response(self.get_serializer(review).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        review = self.get_object()
        review.status = Review.Status.REJECTED
        review.save(update_fields=["status"])
        return Response(self.get_serializer(review).data)
