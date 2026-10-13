"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiDollarSign, FiInfo, FiList, FiPackage, FiPlus, FiShoppingBag, FiTrendingUp } from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";
import StatusBadge from "@/components/admin/StatusBadge";
import RangeFilter from "@/components/admin/analytics/RangeFilter";
import KpiCard from "@/components/admin/analytics/KpiCard";
import InlineStats from "@/components/admin/analytics/InlineStats";
import ChartCard from "@/components/admin/analytics/ChartCard";
import MetricToggle from "@/components/admin/analytics/MetricToggle";
import { useAnalyticsRange } from "@/components/admin/analytics/AnalyticsRangeContext";
import { useAnalyticsResource } from "@/components/admin/analytics/useAnalyticsResource";
import { METRIC_CONFIG, OrderStatusChart, RevenueTrendChart } from "@/components/admin/analytics/charts";
import { getOrderStatus, getRecentOrders, getSalesTrend, getSummary } from "@/lib/analytics";
import { formatBDT, formatDate, formatNumber } from "@/lib/format";

// Same metric definitions as the admin Overview (backend apps/analytics/rules.py):
// revenue counts confirmed, processing, shipped and delivered orders only.
const PRIMARY_SALES = [
  { key: "net_sales", label: "Total Sales Revenue", icon: FiDollarSign, format: formatBDT, tooltip: "Product sales minus discounts, excluding delivery charges. Counts confirmed, processing, shipped and delivered orders — never pending or cancelled ones." },
  { key: "total_orders", label: "Total Orders", icon: FiShoppingBag, format: formatNumber, tooltip: "Every order created in the period, including pending and cancelled." },
  { key: "average_order_value", label: "Average Order Value", icon: FiTrendingUp, format: formatBDT, tooltip: "Total sales revenue divided by the number of revenue-eligible orders." },
  { key: "units_sold", label: "Total Products Sold", icon: FiPackage, format: formatNumber, tooltip: "Item quantities across revenue-eligible orders; add-on items included." },
];

const TREND_METRICS = ["revenue", "orders"].map((key) => ({ key, label: METRIC_CONFIG[key].label }));

export default function CceDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { query, label, isReady } = useAnalyticsRange();
  const [metric, setMetric] = useState("revenue");
  const key = JSON.stringify(query);

  const summary = useAnalyticsResource(() => getSummary(query), [key], { enabled: isReady });
  const trend = useAnalyticsResource(() => getSalesTrend(query), [key], { enabled: isReady });
  const status = useAnalyticsResource(() => getOrderStatus(query), [key], { enabled: isReady });
  const recent = useAnalyticsResource(() => getRecentOrders(query, { scope: "latest", limit: 6 }), [], {});

  const sales = summary.data?.sales;
  const points = trend.data?.points ?? [];
  const trendIsEmpty = points.length === 0 || points.every((p) => !p.orders && !Number(p.revenue));
  const statusCount = (value) => status.data?.results?.find((row) => row.status === value)?.count ?? 0;

  const statusStats = [
    { label: "Pending", tooltip: "Orders awaiting confirmation (not counted as sales).", value: status.loading ? "—" : formatNumber(statusCount("pending")) },
    { label: "Confirmed", tooltip: "Orders with status 'confirmed' in this period.", value: status.loading ? "—" : formatNumber(statusCount("confirmed")) },
    { label: "Cancelled", tooltip: "Orders with status 'cancelled'; excluded from revenue.", value: summary.loading ? "—" : formatNumber(sales?.cancelled_orders?.value), changePct: summary.loading ? undefined : sales?.cancelled_orders?.change_pct },
    { label: "Returned", tooltip: "Returns aren't recorded anywhere in the system yet, so this is always 0.", value: summary.loading ? "—" : formatNumber(sales?.returned_orders?.value) },
  ];

  return (
    <div className="pb-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-neutral-900">Welcome back, {user?.name}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
            <FiInfo size={13} />
            Showing {label}
            {summary.data?.range && (
              <span className="text-neutral-400">({summary.data.range.start} → {summary.data.range.end})</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/cce/orders/new"
            className="flex items-center gap-1.5 rounded-lg bg-(--primary) px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90"
          >
            <FiPlus size={15} />
            Create Order
          </Link>
          <Link
            href="/dashboard/cce/orders"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <FiList size={15} />
            All Orders
          </Link>
          <RangeFilter />
        </div>
      </div>

      {summary.error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {summary.error}{" "}
          <button type="button" onClick={summary.reload} className="font-semibold underline">
            Retry
          </button>
        </p>
      )}

      <section className="mb-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {PRIMARY_SALES.map((def) => {
            const value = sales?.[def.key];
            return (
              <KpiCard
                key={def.key}
                label={def.label}
                icon={def.icon}
                tooltip={def.tooltip}
                loading={summary.loading}
                changePct={value?.change_pct}
                value={def.format(value?.value)}
              />
            );
          })}
        </div>
        <InlineStats className="mt-3" items={statusStats} />
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <ChartCard
          className="min-w-0 lg:col-span-2"
          title="Sales Trend"
          loading={trend.loading}
          error={trend.error}
          onRetry={trend.reload}
          isEmpty={trendIsEmpty}
          height={220}
          right={<MetricToggle value={metric} onChange={setMetric} options={TREND_METRICS} />}
        >
          <RevenueTrendChart points={points} metric={metric} />
        </ChartCard>

        <ChartCard
          className="min-w-0"
          title="Order Status"
          subtitle="Click a slice to see those orders"
          loading={status.loading}
          error={status.error}
          onRetry={status.reload}
          isEmpty={!status.data?.total}
          height={220}
        >
          <OrderStatusChart
            data={status.data?.results?.filter((row) => row.count > 0)}
            onSelect={(value) => router.push(`/dashboard/cce/orders?status=${value}`)}
          />
        </ChartCard>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Recent Orders</h2>
            <p className="text-xs text-neutral-500">Latest orders overall (not limited to the selected period).</p>
          </div>
          <Link href="/dashboard/cce/orders" className="text-sm font-medium text-(--primary) hover:underline">
            View all
          </Link>
        </div>
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 whitespace-nowrap text-neutral-500">
                <th className="px-5 py-3 font-medium">Order</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Phone</th>
                <th className="px-5 py-3 font-medium text-right">Total</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Placed</th>
              </tr>
            </thead>
            <tbody>
              {recent.loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-neutral-500">Loading…</td>
                </tr>
              ) : recent.error ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-red-600">
                    {recent.error}{" "}
                    <button type="button" onClick={recent.reload} className="font-semibold underline">
                      Retry
                    </button>
                  </td>
                </tr>
              ) : (recent.data?.results ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-neutral-500">No orders yet.</td>
                </tr>
              ) : (
                recent.data.results.map((order) => (
                  <tr key={order.id} className="border-b border-neutral-100 whitespace-nowrap last:border-0">
                    <td className="px-5 py-3 font-medium text-neutral-900">
                      <Link href={`/dashboard/cce/orders/${order.id}`} className="hover:text-(--primary) hover:underline">
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-neutral-600">{order.customer_name}</td>
                    <td className="px-5 py-3 text-neutral-600">{order.customer_phone || "—"}</td>
                    <td className="px-5 py-3 text-right text-neutral-900">{formatBDT(order.grand_total)}</td>
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
