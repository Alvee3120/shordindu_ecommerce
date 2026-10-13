import csv

from django.db.models import Count
from django.http import StreamingHttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.permissions import CanManageOrders, IsAdminOnly, is_admin
from apps.orders.models import Order

from . import services
from .date_ranges import resolve_range
from .serializers import CustomerPerformanceSerializer, ProductPerformanceSerializer


def _int_param(request, name, default=None, minimum=None, maximum=None):
    raw = request.query_params.get(name)
    if raw in (None, ""):
        return default
    try:
        value = int(raw)
    except (TypeError, ValueError):
        raise ValidationError({name: ["Must be an integer."]})
    if minimum is not None:
        value = max(value, minimum)
    if maximum is not None:
        value = min(value, maximum)
    return value


class AnalyticsViewSet(viewsets.GenericViewSet):
    """Read-only analytics endpoints. See ``services`` for formulas.

    Everything is admin-only except the sales-overview endpoints the CCE
    dashboard uses (same numbers and rules as the admin Overview).
    """

    permission_classes = [IsAdminOnly]
    ORDER_MANAGER_ACTIONS = ("summary", "sales_trend", "order_status", "recent_orders")

    def get_permissions(self):
        if self.action in self.ORDER_MANAGER_ACTIONS:
            return [CanManageOrders()]
        return super().get_permissions()

    def resolve(self):
        params = self.request.query_params
        return resolve_range(params.get("range"), params.get("start"), params.get("end"))

    @action(detail=False, methods=["get"])
    def summary(self, request):
        data = services.sales_summary(self.resolve())
        if not is_admin(request.user):
            # Catalog/customer-base totals are admin information.
            data.pop("business", None)
        return Response(data)

    @action(detail=False, methods=["get"], url_path="sales-trend")
    def sales_trend(self, request):
        rng = self.resolve()
        granularity = request.query_params.get("granularity", "auto")
        return Response(services.sales_trend(rng, granularity))

    @action(detail=False, methods=["get"], url_path="order-status")
    def order_status(self, request):
        return Response(services.order_status_distribution(self.resolve()))

    @action(detail=False, methods=["get"], url_path="top-products")
    def top_products(self, request):
        rng = self.resolve()
        sort = request.query_params.get("sort", "units")
        if sort not in ("units", "revenue"):
            sort = "units"
        limit = _int_param(request, "limit", default=5, minimum=1, maximum=50)
        return Response(services.top_products(rng, sort, limit, request=request))

    @action(detail=False, methods=["get"])
    def categories(self, request):
        rng = self.resolve()
        sort = request.query_params.get("sort", "revenue")
        if sort not in ("units", "orders", "revenue"):
            sort = "revenue"
        return Response(services.category_sales(rng, sort, request=request))

    @action(detail=False, methods=["get"])
    def products(self, request):
        rng = self.resolve()
        compare = request.query_params.get("compare") in ("1", "true", "True")
        movers = request.query_params.get("movers")
        qs = services.product_performance_queryset(
            rng,
            search=request.query_params.get("search"),
            status=request.query_params.get("status"),
            category=_int_param(request, "category"),
            ordering=request.query_params.get("ordering"),
            compare=compare,
            movers=movers if compare else None,
        )
        page = self.paginate_queryset(qs)
        data = ProductPerformanceSerializer(page, many=True, context={"request": request}).data
        return self.get_paginated_response(data)

    @action(detail=False, methods=["get"], url_path="customers/summary")
    def customers_summary(self, request):
        rng = self.resolve()
        data = services.customer_summary(rng)
        data["growth"] = services.customer_growth(
            rng, request.query_params.get("granularity", "auto")
        )["points"]
        return Response(data)

    @action(detail=False, methods=["get"])
    def customers(self, request):
        qs = services.customer_performance_queryset(
            search=request.query_params.get("search"),
            ordering=request.query_params.get("ordering"),
        )
        page = self.paginate_queryset(qs)
        data = CustomerPerformanceSerializer(page, many=True).data
        return self.get_paginated_response(data)

    @action(detail=False, methods=["get"], url_path="recent-orders")
    def recent_orders(self, request):
        rng = self.resolve()
        scope = request.query_params.get("scope", "latest")
        if scope not in ("latest", "period"):
            scope = "latest"
        limit = _int_param(request, "limit", default=8, minimum=1, maximum=50)
        return Response(services.recent_orders(rng, scope, limit))

    @action(detail=False, methods=["get"])
    def export(self, request):
        rng = self.resolve()
        dataset = request.query_params.get("dataset", "products")
        if dataset not in ("products", "categories", "orders"):
            return Response(
                {"dataset": ["Allowed: products, categories, orders."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        header, rows, filename = self._export_rows(dataset, rng, request)

        response = StreamingHttpResponse(
            self._csv_stream(header, rows), content_type="text/csv"
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

    def _export_rows(self, dataset, rng, request):
        if dataset == "products":
            qs = services.product_performance_queryset(rng)
            header = ["name", "sku", "status", "stock_quantity", "units_sold", "revenue"]
            data = ProductPerformanceSerializer(qs, many=True, context={"request": request}).data
            rows = [
                {
                    "name": row["name"],
                    "sku": row["sku"] or "",
                    "status": row["status"],
                    "stock_quantity": row["stock_quantity"],
                    "units_sold": row["units_sold"],
                    "revenue": row["revenue"],
                }
                for row in data
            ]
            return header, rows, "product-performance.csv"

        if dataset == "categories":
            data = services.category_sales(rng, "revenue", request=request)["results"]
            header = ["category", "products", "units_sold", "orders", "gross_sales", "net_sales", "contribution_pct"]
            rows = [
                {
                    "category": row["name"],
                    "products": row["product_count"],
                    "units_sold": row["units_sold"],
                    "orders": row["orders"],
                    "gross_sales": row["gross_sales"],
                    "net_sales": row["net_sales"],
                    "contribution_pct": row["contribution_pct"],
                }
                for row in data
            ]
            return header, rows, "category-performance.csv"

        orders = (
            Order.objects.filter(placed_at__gte=rng.start, placed_at__lt=rng.end)
            .select_related("user")
            .annotate(item_count=Count("items"))
            .order_by("-placed_at")
        )
        header = ["order_number", "placed_at", "status", "payment_status", "items", "grand_total"]
        rows = [
            {
                "order_number": order.order_number,
                "placed_at": order.placed_at.isoformat(),
                "status": order.status,
                "payment_status": order.payment_status,
                "items": order.item_count,
                "grand_total": order.grand_total,
            }
            for order in orders
        ]
        return header, rows, "orders.csv"

    @staticmethod
    def _csv_stream(header, rows):
        class _Echo:
            def write(self, value):
                return value

        writer = csv.writer(_Echo())
        yield writer.writerow(header)
        for row in rows:
            yield writer.writerow([row.get(column, "") for column in header])
