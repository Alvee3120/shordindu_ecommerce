from django.db.models import Sum
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import ProductAddon
from apps.catalog.pricing import PricingEngine

from .cart_resolver import CartMixin
from .models import CartItem
from .services import addon_unit_price, reprice_cart
from .serializers import CartItemCreateSerializer, CartItemSerializer, CartSerializer


class CartView(CartMixin, APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        cart = self.get_cart(request)
        engine = reprice_cart(cart)
        return Response(CartSerializer(cart, context={"request": request, "pricing_engine": engine}).data)


class CartItemViewSet(CartMixin, viewsets.ModelViewSet):
    permission_classes = [permissions.AllowAny]
    serializer_class = CartItemSerializer

    def get_queryset(self):
        cart = self.get_cart(self.request)
        return CartItem.objects.filter(cart=cart)

    def create(self, request, *args, **kwargs):
        cart = self.get_cart(request)
        serializer = CartItemCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = serializer.validated_data["product"]
        variation = serializer.validated_data["variation"]
        quantity = serializer.validated_data["quantity"]

        unit_price = PricingEngine().price(variation)
        existing = CartItem.objects.filter(
            cart=cart, product=product, variation=variation, parent_cart_item__isnull=True
        ).first()
        if existing:
            existing.quantity += quantity
            existing.unit_price_snapshot = unit_price
            existing.save(update_fields=["quantity", "unit_price_snapshot"])
            return Response(CartItemSerializer(existing).data, status=status.HTTP_200_OK)

        item = CartItem.objects.create(
            cart=cart, product=product, variation=variation, quantity=quantity,
            unit_price_snapshot=unit_price,
        )
        return Response(CartItemSerializer(item).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def addons(self, request, pk=None):
        cart = self.get_cart(request)
        parent_item = get_object_or_404(CartItem, pk=pk, cart=cart)

        serializer = CartItemCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = serializer.validated_data["product"]
        variation = serializer.validated_data["variation"]
        quantity = serializer.validated_data["quantity"]

        addon_link = ProductAddon.objects.filter(
            parent_product_id=parent_item.product_id, addon_product=product
        ).first()
        if not addon_link:
            return Response(
                {"product": ["This product is not a valid addon for the parent item."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_qty = CartItem.objects.filter(parent_cart_item=parent_item, product=product).aggregate(
            total=Sum("quantity")
        )["total"] or 0
        if existing_qty + quantity > addon_link.max_select:
            return Response(
                {"quantity": [f"Max {addon_link.max_select} allowed for this addon."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        unit_price = addon_unit_price(variation, PricingEngine(), override=addon_link.price_override)
        item = CartItem.objects.create(
            cart=cart, product=product, variation=variation, quantity=quantity,
            unit_price_snapshot=unit_price, parent_cart_item=parent_item,
        )
        return Response(CartItemSerializer(item).data, status=status.HTTP_201_CREATED)
