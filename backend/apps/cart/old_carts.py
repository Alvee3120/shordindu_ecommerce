from datetime import timedelta
from decimal import Decimal

from django.db.models import DecimalField, Exists, F, Max, Min, OuterRef, Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.users.models import User

from .models import Cart, CartItem

# "Old" means strictly older than this. Exactly 6 hours is NOT old.
OLD_CART_THRESHOLD = timedelta(hours=6)
OLD_CART_THRESHOLD_HOURS = 6

AGE_FILTERS = ("6-24h", "1-3d", "3d+")
ORDERING_FIELDS = {"oldest_item_at", "last_item_at", "cart_value", "item_count"}


def old_cart_cutoff(now=None):
    return (now or timezone.now()) - OLD_CART_THRESHOLD


def old_carts_queryset(params=None, now=None):
    """Active customer carts containing at least one item older than the
    threshold. Status is derived from CartItem.created_at on every query —
    there is no stored is_old flag.

    Aggregations deliberately span *all* of a cart's items; qualification is
    done with the filtered `old_item_count` annotation (a HAVING clause), not
    by pre-filtering the items join (which would distort every other sum).
    """
    params = params or {}
    now = now or timezone.now()
    cutoff = now - OLD_CART_THRESHOLD
    value_field = DecimalField(max_digits=12, decimal_places=2)

    qs = (
        Cart.objects.filter(user__isnull=False, user__role=User.Role.CUSTOMER)
        .select_related("user")
        .annotate(
            item_count=Coalesce(Sum("items__quantity"), 0),
            old_item_count=Coalesce(
                Sum("items__quantity", filter=Q(items__created_at__lt=cutoff)), 0
            ),
            cart_value=Coalesce(
                Sum(
                    F("items__quantity") * F("items__unit_price_snapshot"),
                    output_field=value_field,
                ),
                Decimal("0.00"),
                output_field=value_field,
            ),
            oldest_item_at=Min("items__created_at"),
            last_item_at=Max("items__created_at"),
        )
        .filter(old_item_count__gt=0)
    )

    search = (params.get("search") or "").strip()
    if search:
        product_match = Exists(
            CartItem.objects.filter(cart_id=OuterRef("pk"), product__name__icontains=search)
        )
        qs = qs.filter(
            Q(user__name__icontains=search)
            | Q(user__phone__icontains=search)
            | Q(user__email__icontains=search)
            | product_match
        )

    age = params.get("age")
    if age == "6-24h":
        qs = qs.filter(
            oldest_item_at__gte=now - timedelta(hours=24),
            oldest_item_at__lt=cutoff,
        )
    elif age == "1-3d":
        qs = qs.filter(
            oldest_item_at__gte=now - timedelta(days=3),
            oldest_item_at__lt=now - timedelta(hours=24),
        )
    elif age == "3d+":
        qs = qs.filter(oldest_item_at__lt=now - timedelta(days=3))

    ordering = params.get("ordering") or "-oldest_item_at"
    if ordering.lstrip("-") not in ORDERING_FIELDS:
        ordering = "-oldest_item_at"

    return qs.order_by(ordering, "-id")


def old_carts_summary(now=None):
    """Customer-based count (one cart per customer) plus old item units."""
    now = now or timezone.now()
    cutoff = now - OLD_CART_THRESHOLD

    customers = old_carts_queryset({}, now=now).count()
    old_items = (
        CartItem.objects.filter(
            cart__user__isnull=False,
            cart__user__role=User.Role.CUSTOMER,
            created_at__lt=cutoff,
        ).aggregate(total=Sum("quantity"))["total"]
        or 0
    )

    return {
        "threshold_hours": OLD_CART_THRESHOLD_HOURS,
        "customers": customers,
        "old_items": old_items,
    }
