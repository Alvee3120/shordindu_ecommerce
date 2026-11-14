from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import ProductAddon
from apps.catalog.pricing import PricingEngine
from apps.core.permissions import CanManageOrders

from .cart_resolver import CartMixin
from .models import CartItem
from .old_carts import old_carts_queryset, old_carts_summary
from .serializers import (
    CartItemCreateSerializer,
    CartItemSerializer,
    CartSerializer,
    OldCartDetailSerializer,
    OldCartSummarySerializer,
)
from .services import addon_unit_price, cart_promotions, reprice_cart


class CartView(CartMixin, APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        cart = self.get_cart(request)
        engine = reprice_cart(cart)
        promotions = cart_promotions(cart, engine)
        return Response(
            CartSerializer(
                cart, context={"request": request, "pricing_engine": engine, "promotions": promotions}
            ).data
        )


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


class OldCartListView(generics.ListAPIView):
    """Admin/CCE: active customer carts with at least one item older than
    the threshold. The status is derived from CartItem.created_at."""

    serializer_class = OldCartSummarySerializer
    permission_classes = [CanManageOrders]

    def get_queryset(self):
        return old_carts_queryset(self.request.query_params)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["now"] = timezone.now()
        return context


class OldCartSummaryView(APIView):
    permission_classes = [CanManageOrders]

    def get(self, request):
        return Response(old_carts_summary())


class OldCartDetailView(generics.RetrieveAPIView):
    """Admin/CCE: full read-only contents of one old cart, with current
    prices (through the same reprice path the cart itself uses), current
    stock, and per-item ages."""

    serializer_class = OldCartDetailSerializer
    permission_classes = [CanManageOrders]

    def get_queryset(self):
        return old_carts_queryset()

    def retrieve(self, request, *args, **kwargs):
        cart = self.get_object()
        engine = reprice_cart(cart)
        promotions = cart_promotions(cart, engine)
        context = self.get_serializer_context()
        context.update(
            {
                "pricing_engine": engine,
                "promotions": promotions,
                "now": timezone.now(),
            }
        )
        serializer = self.get_serializer(cart, context=context)
        return Response(serializer.data)

