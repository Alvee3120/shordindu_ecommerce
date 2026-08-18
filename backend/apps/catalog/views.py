from rest_framework import viewsets

from apps.core.permissions import IsStaffOrReadOnly

from .models import Attribute, AttributeValue, Category
from .serializers import (
    AttributeSerializer,
    AttributeValueSerializer,
    CategoryDetailSerializer,
    CategorySerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all().order_by("name")
    permission_classes = [IsStaffOrReadOnly]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return CategoryDetailSerializer
        return CategorySerializer


class AttributeViewSet(viewsets.ModelViewSet):
    queryset = Attribute.objects.all().order_by("name")
    serializer_class = AttributeSerializer
    permission_classes = [IsStaffOrReadOnly]


class AttributeValueViewSet(viewsets.ModelViewSet):
    queryset = AttributeValue.objects.all()
    serializer_class = AttributeValueSerializer
    permission_classes = [IsStaffOrReadOnly]
