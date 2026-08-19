from django.db import transaction

from .cart_resolver import CART_COOKIE_NAME
from .models import Cart, CartItem


@transaction.atomic
def merge_guest_cart(request, user):
    """Folds the guest cart referenced by the request's cart_token cookie
    (if any) into the given user's cart, preserving addon nesting."""
    raw_token = request.COOKIES.get(CART_COOKIE_NAME)
    if not raw_token:
        return

    guest_cart = Cart.objects.filter(token=raw_token, user__isnull=True).first()
    if not guest_cart:
        return

    user_cart, _ = Cart.objects.get_or_create(user=user)
    top_level_items = guest_cart.items.filter(parent_cart_item__isnull=True)

    for guest_item in top_level_items:
        existing = user_cart.items.filter(
            product=guest_item.product, variation=guest_item.variation, parent_cart_item__isnull=True
        ).first()
        if existing:
            existing.quantity += guest_item.quantity
            existing.save(update_fields=["quantity"])
            new_parent = existing
        else:
            new_parent = CartItem.objects.create(
                cart=user_cart,
                product=guest_item.product,
                variation=guest_item.variation,
                quantity=guest_item.quantity,
                unit_price_snapshot=guest_item.unit_price_snapshot,
            )
        for addon_item in guest_item.children.all():
            CartItem.objects.create(
                cart=user_cart,
                product=addon_item.product,
                variation=addon_item.variation,
                quantity=addon_item.quantity,
                unit_price_snapshot=addon_item.unit_price_snapshot,
                parent_cart_item=new_parent,
            )

    guest_cart.delete()
