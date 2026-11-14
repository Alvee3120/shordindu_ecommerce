"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FiDollarSign,
  FiShoppingBag,
  FiTrendingUp,
  FiPackage,
  FiBox,
  FiGrid,
  FiUsers,
  FiInfo,
} from "react-icons/fi";
import StatusBadge from "@/components/admin/StatusBadge";
import RangeFilter from "@/components/admin/analytics/RangeFilter";
import KpiCard from "@/components/admin/analytics/KpiCard";
import InlineStats from "@/components/admin/analytics/InlineStats";
import ChartCard, { EmptyState } from "@/components/admin/analytics/ChartCard";
import MetricToggle from "@/components/admin/analytics/MetricToggle";
import { useAnalyticsRange } from "@/components/admin/analytics/AnalyticsRangeContext";
import { useAnalyticsResource } from "@/components/admin/analytics/useAnalyticsResource";
import {
  CategoryBarChart,
  METRIC_CONFIG,
  OrderStatusChart,
  RevenueTrendChart,
} from "@/components/admin/analytics/charts";
import { getCategorySales, getOrderStatus, getRecentOrders, getSalesTrend, getSummary, getTopProducts } from "@/lib/analytics";
import { formatBDT, formatDate, formatNumber } from "@/lib/format";

const PRIMARY_SALES = [
  { key: "net_sales", label: "Total Sales Revenue", icon: FiDollarSign, format: formatBDT, tooltip: "Gross product sales minus discounts, excluding delivery charges. Counts confirmed, processing, shipped and delivered orders." },
  { key: "total_orders", label: "Total Orders", icon: FiShoppingBag, format: formatNumber, tooltip: "Every order created in the period, including pending and cancelled." },
  { key: "average_order_value", label: "Average Order Value", icon: FiTrendingUp, format: formatBDT, tooltip: "Net sales divided by eligible (non-pending, non-cancelled) orders." },
  { key: "units_sold", label: "Total Products Sold", icon: FiPackage, format: formatNumber, tooltip: "Sum of item quantities across eligible orders; add-on items included." },
];

const SECONDARY_SALES = [
  { key: "gross_sales", label: "Gross Sales", format: formatBDT, tooltip: "Sum of order-item line totals (purchase-time prices) before discounts." },
  { key: "discounts", label: "Discounts", format: formatBDT, tooltip: "Sum of order-level discounts (from coupon redemptions)." },
  { key: "delivery_charges", label: "Delivery", format: formatBDT, tooltip: "Shipping totals collected — reported separately from product revenue." },
  { key: "cancelled_orders", label: "Cancelled", format: formatNumber, tooltip: "Orders with status 'cancelled'; excluded from revenue." },
  { key: "returned_orders", label: "Returned", format: formatNumber, tooltip: "The schema has no return or refund records, so this is always 0." },
];

const PRIMARY_BUSINESS = [
  { key: "total_products", label: "Total Products", icon: FiBox },
  { key: "total_categories", label: "Total Categories", icon: FiGrid },
  { key: "total_customers", label: "Total Customers", icon: FiUsers },
];

function AnalyticsOverview() {
  const { query, label, isReady } = useAnalyticsRange();
  const [metric, setMetric] = useState("revenue");
  const key = JSON.stringify(query);
  const metricOptions = Object.entries(METRIC_CONFIG).map(([k, v]) => ({ key: k, label: v.label }));

  const summary = useAnalyticsResource(() => getSummary(query), [key], { enabled: isReady });
  const trend = useAnalyticsResource(() => getSalesTrend(query), [key], { enabled: isReady });
  const status = useAnalyticsResource(() => getOrderStatus(query), [key], { enabled: isReady });
  const topProducts = useAnalyticsResource(() => getTopProducts(query, { sort: "units", limit: 5 }), [key], { enabled: isReady });
  const topCategories = useAnalyticsResource(() => getCategorySales(query, { sort: "revenue" }), [key], { enabled: isReady });
  const recent = useAnalyticsResource(() => getRecentOrders(query, { scope: "latest", limit: 5 }), [key], { enabled: isReady });

  const sales = summary.data?.sales;
  const business = summary.data?.business;
  const points = trend.data?.points ?? [];
  const trendIsEmpty = points.length === 0 || points.every((p) => !p.orders && !Number(p.revenue));

  const secondarySales = SECONDARY_SALES.map((item) => ({
    label: item.label,
    tooltip: item.tooltip,
    value: summary.loading ? "—" : item.format(sales?.[item.key]?.value),
  }));
  const secondaryBusiness = [
    { label: "Active", tooltip: "Products with status 'active'.", value: summary.loading ? "—" : formatNumber(business?.active_products?.value) },
    { label: "Out of stock", tooltip: "Products with 0 units across all variations.", value: summary.loading ? "—" : formatNumber(business?.out_of_stock_products?.value) },
    { label: "Low stock", tooltip: "Products with 1–5 total units in stock (dashboard threshold).", value: summary.loading ? "—" : formatNumber(business?.low_stock_products?.value) },
    { label: "New customers", tooltip: "Customer accounts registered during the selected period.", value: summary.loading ? "—" : formatNumber(business?.new_customers?.value), changePct: summary.loading ? undefined : business?.new_customers?.change_pct },
  ];

  return (
    <div className="pb-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Overview</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
            <FiInfo size={13} />
            Showing {label}
            {summary.data?.range && (
              <span className="text-neutral-400">({summary.data.range.start} → {summary.data.range.end})</span>
            )}
          </p>
        </div>
        <RangeFilter />
      </div>

      {summary.error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{summary.error}</p>
      )}

      {/* Sales summary */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Sales</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PRIMARY_SALES.map((def) => {
            const metric = sales?.[def.key];
            return (
              <KpiCard
                key={def.key}
                label={def.label}
                icon={def.icon}
                tooltip={def.tooltip}
                loading={summary.loading}
                changePct={metric?.change_pct}
                value={def.format(metric?.value)}
              />
            );
          })}
        </div>
        <InlineStats className="mt-3" items={secondarySales} />
      </section>

      {/* Business overview (current state) */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">
          Business <span className="font-normal text-neutral-400">(current state)</span>
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {PRIMARY_BUSINESS.map((def) => (
            <KpiCard
              key={def.key}
              label={def.label}
              icon={def.icon}
              loading={summary.loading}
              value={formatNumber(business?.[def.key]?.value)}
            />
          ))}
        </div>
        <InlineStats className="mt-3" items={secondaryBusiness} />
      </section>

      {/* Three compact visualizations */}
      <div className="grid gap-5 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Sales Trend"
          loading={trend.loading}
          error={trend.error}
          onRetry={trend.reload}
          isEmpty={trendIsEmpty}
          height={240}
          right={<MetricToggle value={metric} onChange={setMetric} options={metricOptions} />}
        >
          <RevenueTrendChart points={points} metric={metric} />
        </ChartCard>

        <ChartCard
          title="Order Status"
          loading={status.loading}
          error={status.error}
          onRetry={status.reload}
          isEmpty={!status.data?.total}
          height={240}
        >
          <OrderStatusChart data={status.data?.results} />
        </ChartCard>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Top Categories"
          subtitle="Top 5 by net sales"
          loading={topCategories.loading}
          error={topCategories.error}
          onRetry={topCategories.reload}
          isEmpty={!(topCategories.data?.results ?? []).length}
          height={240}
          right={
            <Link href="/dashboard/admin/categories" className="text-sm font-medium text-(--primary) hover:underline">
              Category analytics
            </Link>
          }
        >
          <CategoryBarChart data={topCategories.data?.results} limit={5} />
        </ChartCard>

        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-neutral-900">Best-Selling Products</h3>
            <Link href="/dashboard/admin/products" className="text-sm font-medium text-(--primary) hover:underline">
              View all
            </Link>
          </div>
          {topProducts.loading ? (
            <p className="py-6 text-center text-sm text-neutral-500">Loading…</p>
          ) : topProducts.error ? (
            <p className="py-6 text-center text-sm text-red-600">{topProducts.error}</p>
          ) : (topProducts.data?.results ?? []).length === 0 ? (
            <EmptyState message="No product sales in this period." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {topProducts.data.results.map((product) => (
                <li key={product.id} className="flex items-center gap-3 py-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                    {product.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <FiBox size={15} className="text-neutral-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/dashboard/admin/products/${product.id}`} className="block truncate text-sm font-medium text-neutral-900 hover:text-(--primary)">
                      {product.name}
                    </Link>
                    <p className="truncate text-xs text-neutral-500">{product.categories?.join(", ") || "Uncategorised"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-neutral-900">{product.units_sold} sold</p>
                    <p className="text-xs text-neutral-500">{formatBDT(product.net_sales)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Compact recent orders */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Recent Orders</h2>
            <p className="text-xs text-neutral-500">Latest orders overall (not limited to the selected period).</p>
          </div>
          <Link href="/dashboard/admin/orders" className="text-sm font-medium text-(--primary) hover:underline">
            View all
          </Link>
        </div>
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-5 py-3 font-medium">Order</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Placed</th>
              </tr>
            </thead>
            <tbody>
              {recent.loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-neutral-500">Loading…</td>
                </tr>
              ) : recent.error ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-red-600">{recent.error}</td>
                </tr>
              ) : (recent.data?.results ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-neutral-500">No orders yet.</td>
                </tr>
              ) : (
                recent.data.results.map((order) => (
                  <tr key={order.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-5 py-3 font-medium text-neutral-900">
                      <Link href={`/dashboard/admin/orders/${order.id}`} className="hover:text-(--primary) hover:underline">
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-neutral-600">{order.customer_name}</td>
                    <td className="px-5 py-3 text-neutral-900">{formatBDT(order.grand_total)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge value={order.status} />
                    </td>
                    <td className="px-5 py-3 text-neutral-500">{formatDate(order.placed_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function AdminDashboardPage() {
  return <AnalyticsOverview />;
}
