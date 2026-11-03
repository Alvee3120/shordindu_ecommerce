from collections import defaultdict
from decimal import Decimal

from django.db import transaction

from apps.catalog.models import ProductAddon
from apps.catalog.pricing import PricingEngine
from apps.catalog.promotions import PromotionEngine, units_from_lines

from .cart_resolver import CART_COOKIE_NAME
from .models import Cart, CartItem

ZERO = Decimal("0.00")


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


def addon_unit_price(variation, engine, override=None):
    """Price of an add-on line: the addon link's price_override when one is
    set, otherwise the variation's current (possibly discounted) price."""
    return override if override is not None else engine.price(variation)


def reprice_cart(cart, engine=None):
    """Brings every line's unit_price_snapshot up to the current price.

    Run whenever the cart is read and again at checkout, so a discount that
    started or ended while items sat in the cart is always reflected — the
    stored snapshot is never trusted as-is. Returns the engine it priced with.
    """
    engine = engine or PricingEngine()
    items = list(
        cart.items.select_related("parent_cart_item", "variation__product").prefetch_related(
            "variation__product__categories"
        )
    )
    parent_ids = {item.parent_cart_item.product_id for item in items if item.parent_cart_item_id}
    overrides = {
        (link.parent_product_id, link.addon_product_id): link.price_override
        for link in ProductAddon.objects.filter(parent_product_id__in=parent_ids)
    }

    changed = []
    for item in items:
        if item.parent_cart_item_id:
            key = (item.parent_cart_item.product_id, item.variation.product_id)
            price = addon_unit_price(item.variation, engine, override=overrides.get(key))
        else:
            price = engine.price(item.variation)
        if price != item.unit_price_snapshot:
            item.unit_price_snapshot = price
            changed.append(item)
    if changed:
        CartItem.objects.bulk_update(changed, ["unit_price_snapshot"])
    return engine


def cart_promotions(cart, engine=None):
    """Basket-level offers for the cart's top-level lines (add-ons excluded).

    Priced on each line's *current* effective unit price (``reprice_cart`` runs
    first), so this always matches what checkout will charge. Returns
    ``{"total", "applied", "by_item"}`` where ``by_item`` maps a cart item id to
    the promotion amount/free units shown on that line.
    """
    items = list(
        cart.items.filter(parent_cart_item__isnull=True)
        .select_related("variation__product")
        .prefetch_related("variation__product__categories")
    )
    lines = [
        {
            "product": item.product,
            "variation": item.variation,
            "quantity": item.quantity,
            "unit_price": item.unit_price_snapshot,
        }
        for item in items
    ]
    applied = PromotionEngine(now=engine.now if engine else None).apply(units_from_lines(lines))

    by_item = defaultdict(lambda: {"discount": ZERO, "free": 0, "best": ZERO, "name": "", "label": "", "type": ""})
    for promotion in applied:
        for index, amount in promotion.line_discounts.items():
            entry = by_item[items[index].id]
            entry["discount"] += amount
            if amount > entry["best"]:
                entry.update(best=amount, name=promotion.name, label=promotion.label, type=promotion.type)
        for index, free in promotion.line_free_qty.items():
            by_item[items[index].id]["free"] += free

    total = sum((promotion.discount_amount for promotion in applied), ZERO)
    return {"total": total, "applied": [p.to_dict() for p in applied], "by_item": dict(by_item)}
