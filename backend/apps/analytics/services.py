"""Server-side aggregation for every dashboard metric.

All aggregation happens in the database. Nothing here loads a full order set
into memory except the small, explicitly-paginated result pages built by the
views.

Metric definitions (see also ``rules.py``):

* **Gross sales**   = Σ ``OrderItem.line_total`` over eligible orders.
* **Discounts**     = Σ ``Order.discount_total`` over eligible orders.
* **Delivery**      = Σ ``Order.shipping_total`` over eligible orders.
* **Net sales**     = Gross − Discounts (product revenue, delivery excluded).
* **Total orders**  = every order created in the period (incl. pending/cancelled).
* **AOV**           = Net sales / number of eligible orders.
* **Units sold**    = Σ ``OrderItem.quantity`` over eligible orders (addons included).

Per-product / per-category discounts are *allocated* proportionally to each
line's share of its order's subtotal, because the schema only stores discounts
at the order level.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db.models import (
    Case,
    Count,
    DateTimeField,
    DecimalField,
    F,
    IntegerField,
    Max,
    Min,
    OuterRef,
    Q,
    Subquery,
    Sum,
    When,
)
from django.db.models.functions import Coalesce, TruncDate, TruncMonth, TruncWeek, TruncYear

from apps.catalog.models import Category, Product, ProductVariation
from apps.orders.models import Order, OrderItem
from apps.users.models import User

from .date_ranges import bucket_dates, resolve_range
from .rules import ELIGIBLE_SALES_STATUSES, LOW_STOCK_THRESHOLD

ZERO = Decimal("0.00")
CUSTOMER = User.Role.CUSTOMER


# ---------------------------------------------------------------------------
# small helpers
# ---------------------------------------------------------------------------

def _dec():
    return DecimalField(max_digits=16, decimal_places=2)


def _int():
    return IntegerField()


def _change_pct(current, previous):
    """Percentage change, or ``None`` when the previous value is zero/absent."""
    try:
        prev = Decimal(previous)
        cur = Decimal(current)
    except Exception:
        return None
    if prev == 0:
        return None
    return float(((cur - prev) / prev * 100).quantize(Decimal("0.1")))


def _cmp(current, previous):
    return {"value": current, "previous": previous, "change_pct": _change_pct(current, previous)}


def _metric(value):
    return {"value": value}


def _eligible_items(start, end):
    return OrderItem.objects.filter(
        order__placed_at__gte=start,
        order__placed_at__lt=end,
        order__status__in=ELIGIBLE_SALES_STATUSES,
    )


def _with_net_line(items):
    """Annotate each order item with its proportional share of the order discount."""
    subtotal_sq = Subquery(
        Order.objects.filter(pk=OuterRef("order_id")).values("subtotal")[:1],
        output_field=_dec(),
    )
    discount_sq = Subquery(
        Order.objects.filter(pk=OuterRef("order_id")).values("discount_total")[:1],
        output_field=_dec(),
    )
    return items.annotate(_order_subtotal=subtotal_sq, _order_discount=discount_sq).annotate(
        _net_line=Case(
            When(
                _order_subtotal__gt=0,
                then=F("line_total") - F("_order_discount") * F("line_total") / F("_order_subtotal"),
            ),
            default=F("line_total"),
            output_field=_dec(),
        )
    )


def _stock_subquery():
    return Subquery(
        ProductVariation.objects.filter(product=OuterRef("pk"))
        .values("product")
        .annotate(total=Sum("stock_quantity"))
        .values("total")[:1],
        output_field=_int(),
    )


def _item_agg_subquery(field, start, end, output_field):
    return Subquery(
        _eligible_items(start, end)
        .filter(product=OuterRef("pk"))
        .values("product")
        .annotate(total=Sum(field))
        .values("total")[:1],
        output_field=output_field,
    )


def _as_date(value):
    if isinstance(value, datetime):
        return value.date()
    return value


def _bucket_class(granularity):
    return {
        "daily": TruncDate,
        "weekly": TruncWeek,
        "monthly": TruncMonth,
        "yearly": TruncYear,
    }[granularity]


def _period_meta(rng):
    return {
        "range": rng.as_dict(),
        "low_stock_threshold": LOW_STOCK_THRESHOLD,
        "return_tracking_supported": False,
    }


# ---------------------------------------------------------------------------
# KPI summary
# ---------------------------------------------------------------------------

def _sales_totals(start, end):
    orders = Order.objects.filter(placed_at__gte=start, placed_at__lt=end)
    eligible = orders.filter(status__in=ELIGIBLE_SALES_STATUSES)

    agg = eligible.aggregate(
        gross=Coalesce(Sum("subtotal"), ZERO, output_field=_dec()),
        discounts=Coalesce(Sum("discount_total"), ZERO, output_field=_dec()),
        delivery=Coalesce(Sum("shipping_total"), ZERO, output_field=_dec()),
        qualifying_orders=Count("id"),
    )
    units = _eligible_items(start, end).aggregate(
        units=Coalesce(Sum("quantity"), 0, output_field=_int())
    )["units"]

    net = agg["gross"] - agg["discounts"]
    qualifying = agg["qualifying_orders"]
    aov = (net / qualifying) if qualifying else ZERO

    return {
        "gross_sales": agg["gross"],
        "net_sales": net,
        "discounts": agg["discounts"],
        "delivery_charges": agg["delivery"],
        "total_orders": orders.count(),
        "qualifying_orders": qualifying,
        "average_order_value": aov,
        "units_sold": units,
        "cancelled_orders": orders.filter(status=Order.Status.CANCELLED).count(),
        "returned_orders": 0,
    }


def _business_totals():
    product_qs = Product.objects.annotate(_stock=Coalesce(_stock_subquery(), 0, output_field=_int()))
    products = product_qs.aggregate(
        total=Count("id"),
        active=Count("id", filter=Q(status=Product.Status.ACTIVE)),
        out_of_stock=Count("id", filter=Q(_stock__lte=0)),
        low_stock=Count("id", filter=Q(_stock__gt=0, _stock__lte=LOW_STOCK_THRESHOLD)),
    )
    return {
        "total_products": products["total"],
        "active_products": products["active"],
        "out_of_stock_products": products["out_of_stock"],
        "low_stock_products": products["low_stock"],
        "total_categories": Category.objects.count(),
        "total_customers": User.objects.filter(role=CUSTOMER).count(),
    }


def _new_customers(start, end):
    return User.objects.filter(
        role=CUSTOMER, created_at__gte=start, created_at__lt=end
    ).count()


def sales_summary(rng):
    cur = _sales_totals(rng.start, rng.end)
    prev = _sales_totals(rng.prev_start, rng.prev_end)
    biz = _business_totals()

    sales = {
        "gross_sales": _cmp(cur["gross_sales"], prev["gross_sales"]),
        "net_sales": _cmp(cur["net_sales"], prev["net_sales"]),
        "total_orders": _cmp(cur["total_orders"], prev["total_orders"]),
        "qualifying_orders": _cmp(cur["qualifying_orders"], prev["qualifying_orders"]),
        "average_order_value": _cmp(cur["average_order_value"], prev["average_order_value"]),
        "units_sold": _cmp(cur["units_sold"], prev["units_sold"]),
        "discounts": _cmp(cur["discounts"], prev["discounts"]),
        "delivery_charges": _cmp(cur["delivery_charges"], prev["delivery_charges"]),
        "cancelled_orders": _cmp(cur["cancelled_orders"], prev["cancelled_orders"]),
        "returned_orders": _cmp(cur["returned_orders"], prev["returned_orders"]),
    }
    business = {
        "total_products": _metric(biz["total_products"]),
        "active_products": _metric(biz["active_products"]),
        "out_of_stock_products": _metric(biz["out_of_stock_products"]),
        "low_stock_products": _metric(biz["low_stock_products"]),
        "total_categories": _metric(biz["total_categories"]),
        "total_customers": _metric(biz["total_customers"]),
        "new_customers": _cmp(_new_customers(rng.start, rng.end), _new_customers(rng.prev_start, rng.prev_end)),
    }

    return {**_period_meta(rng), "sales": sales, "business": business}


# ---------------------------------------------------------------------------
# Time series
# ---------------------------------------------------------------------------

_STATUS_KEYS = [value for value, _ in Order.Status.choices]


def _empty_point(bucket, granularity):
    return {
        "date": bucket.isoformat(),
        "label": _format_bucket(bucket, granularity),
        "revenue": ZERO,
        "orders": 0,
        "qualifying": 0,
        "units": 0,
        "aov": ZERO,
        **{status: 0 for status in _STATUS_KEYS},
    }


def _series_points(start, end, granularity):
    trunc_orders = _bucket_class(granularity)("placed_at", tzinfo=_tz())
    trunc_items = _bucket_class(granularity)("order__placed_at", tzinfo=_tz())

    # One grouped query: revenue is restricted to eligible statuses while the
    # order counters cover every created order, broken down per status.
    order_rows = (
        Order.objects.filter(placed_at__gte=start, placed_at__lt=end)
        .annotate(bucket=trunc_orders)
        .values("bucket")
        .annotate(
            revenue=Coalesce(
                Sum(
                    F("subtotal") - F("discount_total"),
                    filter=Q(status__in=ELIGIBLE_SALES_STATUSES),
                    output_field=_dec(),
                ),
                ZERO,
                output_field=_dec(),
            ),
            orders=Count("id"),
            qualifying=Count("id", filter=Q(status__in=ELIGIBLE_SALES_STATUSES)),
            **{
                status: Count("id", filter=Q(status=status))
                for status in _STATUS_KEYS
            },
        )
        .order_by("bucket")
    )
    item_rows = (
        _eligible_items(start, end)
        .annotate(bucket=trunc_items)
        .values("bucket")
        .annotate(units=Coalesce(Sum("quantity"), 0, output_field=_int()))
        .order_by("bucket")
    )

    by_date = {}
    for row in order_rows:
        key = _as_date(row["bucket"])
        entry = by_date.setdefault(key, {})
        entry["revenue"] = row["revenue"]
        entry["orders"] = row["orders"]
        entry["qualifying"] = row["qualifying"]
        for status in _STATUS_KEYS:
            entry[status] = row[status]
    for row in item_rows:
        by_date.setdefault(_as_date(row["bucket"]), {})["units"] = row["units"]

    last_date = (end - timedelta(days=1)).date()
    points = []
    for bucket in bucket_dates(start.date(), last_date, granularity):
        point = _empty_point(bucket, granularity)
        point.update(by_date.get(bucket, {}))
        point["aov"] = (point["revenue"] / point["qualifying"]) if point["qualifying"] else ZERO
        point.pop("qualifying")
        points.append(point)
    return points


def _format_bucket(value, granularity):
    if granularity == "yearly":
        return value.strftime("%Y")
    if granularity == "monthly":
        return value.strftime("%b %Y")
    return value.strftime("%d %b")


def _tz():
    return ZoneInfo(settings.TIME_ZONE)


def sales_trend(rng, granularity="auto"):
    gran = rng.granularity(granularity)
    current = _series_points(rng.start, rng.end, gran)
    previous = _series_points(rng.prev_start, rng.prev_end, gran)

    length = max(len(current), len(previous))
    points = []
    for index in range(length):
        cur = current[index] if index < len(current) else None
        prev = previous[index] if index < len(previous) else None
        base = cur or prev
        points.append(
            {
                "date": (cur or {}).get("date"),
                "label": base["label"],
                "revenue": cur["revenue"] if cur else None,
                "orders": cur["orders"] if cur else None,
                "units": cur["units"] if cur else None,
                "aov": cur["aov"] if cur else None,
                "prev_revenue": prev["revenue"] if prev else None,
                "prev_orders": prev["orders"] if prev else None,
                "prev_units": prev["units"] if prev else None,
                "prev_aov": prev["aov"] if prev else None,
                **{status: (cur.get(status) if cur else None) for status in _STATUS_KEYS},
            }
        )

    return {**_period_meta(rng), "granularity": gran, "points": points}


# ---------------------------------------------------------------------------
# Order status distribution
# ---------------------------------------------------------------------------

def order_status_distribution(rng):
    orders = Order.objects.filter(placed_at__gte=rng.start, placed_at__lt=rng.end)
    counts = {value: 0 for value, _ in Order.Status.choices}
    for row in orders.values("status").annotate(count=Count("id")):
        counts[row["status"]] = row["count"]
    total = sum(counts.values())
    return {
        **_period_meta(rng),
        "total": total,
        "results": [
            {"status": status, "count": count, "pct": round(count / total * 100, 1) if total else 0}
            for status, count in counts.items()
        ],
    }


# ---------------------------------------------------------------------------
# Product detail helpers (no N+1: fetched in one query)
# ---------------------------------------------------------------------------

def product_image_url(product, request):
    images = list(product.images.all())
    image = next((img for img in images if img.is_primary), images[0] if images else None)
    if not image:
        return None
    url = image.image.url
    return request.build_absolute_uri(url) if request else url


def product_sku(product):
    variation = next(iter(product.variations.all()), None)
    return variation.sku if variation else (product.sku_prefix or None)


def _product_brief(product, request):
    return {
        "id": product.id,
        "name": product.name,
        "sku": product_sku(product),
        "image": product_image_url(product, request),
        "categories": [category.name for category in product.categories.all()],
        "status": product.status,
    }


# ---------------------------------------------------------------------------
# Top products
# ---------------------------------------------------------------------------

def _ordered_products(ids):
    products = (
        Product.objects.filter(id__in=ids)
        .prefetch_related("categories", "images", "variations")
    )
    return {product.id: product for product in products}


def top_products(rng, sort="units", limit=5, request=None):
    order_by = "-net" if sort == "revenue" else "-units"
    rows = (
        _with_net_line(_eligible_items(rng.start, rng.end))
        .values("product")
        .annotate(
            units=Coalesce(Sum("quantity"), 0, output_field=_int()),
            gross=Coalesce(Sum("line_total"), ZERO, output_field=_dec()),
            net=Coalesce(Sum("_net_line"), ZERO, output_field=_dec()),
        )
        .order_by(order_by, "-gross")[:limit]
    )

    products = _ordered_products([row["product"] for row in rows])
    results = []
    for row in rows:
        product = products.get(row["product"])
        if not product:
            continue
        results.append(
            {
                **_product_brief(product, request),
                "units_sold": row["units"],
                "gross_sales": row["gross"],
                "net_sales": row["net"],
            }
        )
    return {**_period_meta(rng), "results": results}


# ---------------------------------------------------------------------------
# Category performance
# ---------------------------------------------------------------------------

def _category_tree_rollup(direct):
    """Sum each category with all of its descendants. ``direct`` maps id -> net."""
    parents = dict(Category.objects.values_list("id", "parent_id"))
    children = {}
    for category_id, parent_id in parents.items():
        children.setdefault(parent_id, []).append(category_id)

    rollup = {}

    def total(category_id, seen):
        if category_id in rollup:
            return rollup[category_id]
        if category_id in seen:  # defensive: cycle guard
            return direct.get(category_id, ZERO)
        seen.add(category_id)
        value = direct.get(category_id, ZERO)
        for child in children.get(category_id, []):
            value += total(child, seen)
        rollup[category_id] = value
        return value

    for category_id in parents:
        total(category_id, set())
    return rollup


def category_sales(rng, sort="revenue", request=None):
    rows = (
        _with_net_line(_eligible_items(rng.start, rng.end))
        .values("product__categories__id", "product__categories__name")
        .annotate(
            units=Coalesce(Sum("quantity"), 0, output_field=_int()),
            gross=Coalesce(Sum("line_total"), ZERO, output_field=_dec()),
            net=Coalesce(Sum("_net_line"), ZERO, output_field=_dec()),
            orders=Count("order", distinct=True),
        )
    )

    product_counts = dict(
        Category.objects.annotate(product_count=Count("products", distinct=True)).values_list(
            "id", "product_count"
        )
    )
    direct_net = {row["product__categories__id"]: row["net"] for row in rows if row["product__categories__id"]}
    rollup_net = _category_tree_rollup(direct_net)

    total_net = sum((row["net"] for row in rows), ZERO)
    categories = {category.id: category for category in Category.objects.all()}

    results = []
    for row in rows:
        category_id = row["product__categories__id"]
        if not category_id:
            continue
        category = categories.get(category_id)
        if not category:
            continue
        parent = categories.get(category.parent_id) if category.parent_id else None
        results.append(
            {
                "id": category_id,
                "name": row["product__categories__name"],
                "parent": category.parent_id,
                "parent_name": parent.name if parent else None,
                "image": category_image(category, request),
                "product_count": product_counts.get(category_id, 0),
                "units_sold": row["units"],
                "orders": row["orders"],
                "gross_sales": row["gross"],
                "net_sales": row["net"],
                "rollup_net_sales": rollup_net.get(category_id, row["net"]),
                "contribution_pct": float((row["net"] / total_net * 100).quantize(Decimal("0.1")))
                if total_net
                else 0.0,
            }
        )

    sort_keys = {
        "units": lambda item: item["units_sold"],
        "orders": lambda item: item["orders"],
        "revenue": lambda item: item["net_sales"],
    }
    results.sort(key=sort_keys.get(sort, sort_keys["revenue"]), reverse=True)
    return {**_period_meta(rng), "attributed_net_sales": total_net, "results": results}


def category_image(category, request):
    if not category.image:
        return None
    url = category.image.url
    return request.build_absolute_uri(url) if request else url


# ---------------------------------------------------------------------------
# Product performance table
# ---------------------------------------------------------------------------

def _parse_ordering(value, allowed, default):
    if not value:
        return default
    field = value[1:] if value.startswith("-") else value
    if field not in allowed:
        return default
    return value


def product_performance_queryset(
    rng, search=None, status=None, category=None, ordering=None, compare=False, movers=None
):
    qs = Product.objects.annotate(
        stock_quantity=Coalesce(_stock_subquery(), 0, output_field=_int()),
        units_sold=Coalesce(_item_agg_subquery("quantity", rng.start, rng.end, _int()), 0, output_field=_int()),
        revenue=Coalesce(
            _item_agg_subquery("line_total", rng.start, rng.end, _dec()), ZERO, output_field=_dec()
        ),
    ).prefetch_related("categories", "images", "variations")

    allowed = {"name", "created_at", "units_sold", "revenue", "stock_quantity", "status"}
    if compare:
        # Previous-period columns + their deltas (referenced in a second annotate
        # pass so the F() expressions can see the earlier annotations).
        qs = qs.annotate(
            prev_units_sold=Coalesce(
                _item_agg_subquery("quantity", rng.prev_start, rng.prev_end, _int()), 0, output_field=_int()
            ),
            prev_revenue=Coalesce(
                _item_agg_subquery("line_total", rng.prev_start, rng.prev_end, _dec()), ZERO, output_field=_dec()
            ),
        ).annotate(
            delta_units=F("units_sold") - F("prev_units_sold"),
            delta_revenue=F("revenue") - F("prev_revenue"),
        )
        allowed |= {"prev_units_sold", "prev_revenue", "delta_units", "delta_revenue"}

    if search:
        qs = qs.filter(Q(name__icontains=search) | Q(sku_prefix__icontains=search))
    if status:
        qs = qs.filter(status=status)
    if category:
        qs = qs.filter(categories__id=category)

    default = "-units_sold"
    movers = movers if (compare and movers in ("declining", "growing")) else None
    if movers:
        qs = qs.filter(Q(units_sold__gt=0) | Q(prev_units_sold__gt=0))
        default = "delta_units" if movers == "declining" else "-delta_units"

    ordering = _parse_ordering(ordering, allowed=allowed, default=default)
    return qs.order_by(ordering, "-id")


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------

def customer_summary(rng):
    customers = User.objects.filter(role=CUSTOMER)
    period_orders = Order.objects.filter(
        placed_at__gte=rng.start, placed_at__lt=rng.end, user__isnull=False
    )
    active_count = period_orders.values("user_id").distinct().count()

    repeat_customers = (
        User.objects.filter(role=CUSTOMER).annotate(order_count=Count("orders")).filter(order_count__gt=1).count()
    )

    # Customers whose *first ever* order falls in the period are "new"; the rest
    # of the period's buyers are "returning" (they ordered before the window).
    new_ordering_ids = (
        customers.annotate(first_order=Min("orders__placed_at"))
        .filter(first_order__gte=rng.start, first_order__lt=rng.end)
        .values_list("id", flat=True)
    )
    new_ordering_count = len(list(new_ordering_ids))

    return {
        **_period_meta(rng),
        "total_customers": customers.count(),
        "new_customers": _cmp(_new_customers(rng.start, rng.end), _new_customers(rng.prev_start, rng.prev_end)),
        "active_customers": active_count,
        "new_ordering_customers": new_ordering_count,
        "returning_customers": max(active_count - new_ordering_count, 0),
        "repeat_customers": repeat_customers,
    }


def customer_growth(rng, granularity="auto"):
    gran = rng.granularity(granularity)

    def _points(start, end):
        trunc = _bucket_class(gran)("created_at", tzinfo=_tz())
        rows = (
            User.objects.filter(role=CUSTOMER, created_at__gte=start, created_at__lt=end)
            .annotate(bucket=trunc)
            .values("bucket")
            .annotate(count=Count("id"))
            .order_by("bucket")
        )
        by_date = {_as_date(row["bucket"]): row["count"] for row in rows}
        last_date = (end - timedelta(days=1)).date()
        return [
            {"date": bucket.isoformat(), "label": _format_bucket(bucket, gran), "count": by_date.get(bucket, 0)}
            for bucket in bucket_dates(start.date(), last_date, gran)
        ]

    current = _points(rng.start, rng.end)
    previous = _points(rng.prev_start, rng.prev_end)
    length = max(len(current), len(previous))
    points = []
    for index in range(length):
        cur = current[index] if index < len(current) else None
        prev = previous[index] if index < len(previous) else None
        points.append(
            {
                "date": (cur or {}).get("date"),
                "label": (cur or prev)["label"],
                "count": cur["count"] if cur else None,
                "prev_count": prev["count"] if prev else None,
            }
        )
    return {**_period_meta(rng), "granularity": gran, "points": points}


def customer_performance_queryset(search=None, ordering=None):
    total_orders = Subquery(
        Order.objects.filter(user=OuterRef("pk"))
        .values("user")
        .annotate(count=Count("id"))
        .values("count")[:1],
        output_field=_int(),
    )
    total_spend = Subquery(
        Order.objects.filter(user=OuterRef("pk"), status__in=ELIGIBLE_SALES_STATUSES)
        .values("user")
        .annotate(total=Sum("grand_total"))
        .values("total")[:1],
        output_field=_dec(),
    )
    last_order = Subquery(
        Order.objects.filter(user=OuterRef("pk"))
        .values("user")
        .annotate(latest=Max("placed_at"))
        .values("latest")[:1],
        output_field=DateTimeField(),
    )

    qs = User.objects.filter(role=CUSTOMER).annotate(
        total_orders=Coalesce(total_orders, 0, output_field=_int()),
        total_spend=Coalesce(total_spend, ZERO, output_field=_dec()),
        last_order_at=last_order,
    )

    if search:
        qs = qs.filter(Q(name__icontains=search) | Q(email__icontains=search) | Q(phone__icontains=search))

    ordering = _parse_ordering(
        ordering,
        allowed={"name", "created_at", "total_orders", "total_spend", "last_order_at"},
        default="-total_spend",
    )
    return qs.order_by(ordering, "-id")


# ---------------------------------------------------------------------------
# Recent orders
# ---------------------------------------------------------------------------

def recent_orders(rng, scope="latest", limit=8):
    qs = (
        Order.objects.select_related("user", "shipping_address")
        .annotate(item_count=Count("items"))
    )
    if scope == "period":
        qs = qs.filter(placed_at__gte=rng.start, placed_at__lt=rng.end)
    qs = qs.order_by("-placed_at")[:limit]

    results = []
    for order in qs:
        customer_name = (
            (order.user.name if order.user else None)
            or (order.shipping_address.name if order.shipping_address else None)
            or order.guest_email
            or "Guest"
        )
        results.append(
            {
                "id": order.id,
                "order_number": order.order_number,
                "customer_name": customer_name,
                "customer_phone": order.shipping_address.phone if order.shipping_address else None,
                "placed_at": order.placed_at,
                "item_count": order.item_count,
                "grand_total": order.grand_total,
                "status": order.status,
                "payment_status": order.payment_status,
            }
        )
    return {**_period_meta(rng), "scope": scope, "results": results}
