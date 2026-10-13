"""Single source of truth for the business rules behind every dashboard metric.

Every card, chart, table and CSV export in ``apps.analytics`` reads its
definitions from here so the numbers always reconcile with one another.
"""

from apps.orders.models import Order

# Orders that count as *sales*. Pending orders are unconfirmed and cancelled
# orders never happened, so neither contributes revenue / units / AOV.
ELIGIBLE_SALES_STATUSES = [
    Order.Status.CONFIRMED,
    Order.Status.PROCESSING,
    Order.Status.SHIPPED,
    Order.Status.DELIVERED,
]

# The catalog has no low-stock concept at all, so the dashboard introduces one
# explicit, documented threshold (a variation with 1..N units is "low").
LOW_STOCK_THRESHOLD = 5

# There are no return/refund records anywhere in the schema, so return-based
# metrics are reported as zero rather than fabricated.
RETURN_TRACKING_SUPPORTED = False


def orders_in_period(queryset, start, end):
    """Filter an ``Order`` queryset to ``[start, end)`` on ``placed_at``."""
    return queryset.filter(placed_at__gte=start, placed_at__lt=end)


def eligible_orders(queryset):
    """Keep only orders that qualify as sales (see ``ELIGIBLE_SALES_STATUSES``)."""
    return queryset.filter(status__in=ELIGIBLE_SALES_STATUSES)
