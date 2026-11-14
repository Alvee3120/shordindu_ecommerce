"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FiDownload, FiGrid } from "react-icons/fi";
import RangeFilter from "@/components/admin/analytics/RangeFilter";
import KpiCard from "@/components/admin/analytics/KpiCard";
import MetricToggle from "@/components/admin/analytics/MetricToggle";
import ChartCard from "@/components/admin/analytics/ChartCard";
import PeriodComparisonTable from "@/components/admin/analytics/PeriodComparisonTable";
import ProductMoversTable from "@/components/admin/analytics/ProductMoversTable";
import { useAnalyticsRange } from "@/components/admin/analytics/AnalyticsRangeContext";
import { useAnalyticsResource } from "@/components/admin/analytics/useAnalyticsResource";
import {
  CategoryBarChart,
  CustomerGrowthChart,
  METRIC_CONFIG,
  NewVsReturningChart,
  OrdersTrendChart,
  SalesComparisonChart,
  VolumeTrendChart,
} from "@/components/admin/analytics/charts";
import { downloadCsv, getCategorySales, getCustomerSummary, getSalesTrend, getSummary } from "@/lib/analytics";
import { formatBDT, formatNumber } from "@/lib/format";

const GRANULARITY_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

function SummaryStrip({ data, loading }) {
  const sales = data?.sales;
  const items = [
    { label: "Net Sales", value: formatBDT(sales?.net_sales?.value), change: sales?.net_sales?.change_pct },
    { label: "Orders", value: formatNumber(sales?.total_orders?.value), change: sales?.total_orders?.change_pct },
    { label: "Units Sold", value: formatNumber(sales?.units_sold?.value), change: sales?.units_sold?.change_pct },
    { label: "Avg Order Value", value: formatBDT(sales?.average_order_value?.value), change: sales?.average_order_value?.change_pct },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <KpiCard key={item.label} label={item.label} value={item.value} changePct={item.change} loading={loading} />
      ))}
    </div>
  );
}

export default function SalesAnalyticsPage() {
  const { query, label, isReady } = useAnalyticsRange();
  const [metric, setMetric] = useState("revenue");
  const [granularity, setGranularity] = useState("auto");
  const [categorySort, setCategorySort] = useState("revenue");
  const [exporting, setExporting] = useState(null);
  const key = JSON.stringify(query);
  const trendKey = `${key}|${granularity}`;
  const enabled = isReady;

  const summary = useAnalyticsResource(() => getSummary(query), [key], { enabled });
  const trend = useAnalyticsResource(() => getSalesTrend(query, { granularity }), [trendKey], { enabled });
  const categories = useAnalyticsResource(() => getCategorySales(query, { sort: categorySort }), [key, categorySort], { enabled });
  const customers = useAnalyticsResource(() => getCustomerSummary(query), [key], { enabled });

  const points = trend.data?.points ?? [];
  const trendIsEmpty = points.length === 0 || points.every((p) => !p.orders && !Number(p.revenue));
  const metricOptions = Object.entries(METRIC_CONFIG).map(([k, v]) => ({ key: k, label: v.label }));
  const sales = summary.data?.sales;

  const comparisonItems = [
    { label: "Net Sales", current: sales?.net_sales?.value, previous: sales?.net_sales?.previous, changePct: sales?.net_sales?.change_pct, format: formatBDT },
    { label: "Total Orders", current: sales?.total_orders?.value, previous: sales?.total_orders?.previous, changePct: sales?.total_orders?.change_pct, format: formatNumber },
    { label: "Units Sold", current: sales?.units_sold?.value, previous: sales?.units_sold?.previous, changePct: sales?.units_sold?.change_pct, format: formatNumber },
    { label: "Avg Order Value", current: sales?.average_order_value?.value, previous: sales?.average_order_value?.previous, changePct: sales?.average_order_value?.change_pct, format: formatBDT },
    { label: "Discounts Given", current: sales?.discounts?.value, previous: sales?.discounts?.previous, changePct: sales?.discounts?.change_pct, format: formatBDT },
    { label: "Delivery Collected", current: sales?.delivery_charges?.value, previous: sales?.delivery_charges?.previous, changePct: sales?.delivery_charges?.change_pct, format: formatBDT },
  ];

  const handleExport = async (dataset) => {
    setExporting(dataset);
    try {
      await downloadCsv(query, dataset);
      toast.success(`Exported ${dataset}.csv`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="pb-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Sales Analytics</h1>
          <p className="mt-1 text-sm text-neutral-500">Detailed insights for {label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {["products", "categories", "orders"].map((dataset) => (
            <button
              key={dataset}
              type="button"
              onClick={() => handleExport(dataset)}
              disabled={exporting === dataset}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
            >
              <FiDownload size={14} />
              {exporting === dataset ? "Exporting…" : `Export ${dataset}`}
            </button>
          ))}
          <RangeFilter />
        </div>
      </div>

      {summary.error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{summary.error}</p>
      )}

      <SummaryStrip data={summary.data} loading={summary.loading} />

      {/* 1. Revenue performance: selected vs previous period */}
      <div className="mt-6">
        <ChartCard
          title="Revenue Performance"
          subtitle="Selected period vs previous equivalent period"
          loading={trend.loading}
          error={trend.error}
          onRetry={trend.reload}
          isEmpty={trendIsEmpty}
          height={300}
          right={
            <div className="flex flex-wrap items-center gap-2">
              <MetricToggle value={metric} onChange={setMetric} options={metricOptions} />
              <select
                value={granularity}
                onChange={(event) => setGranularity(event.target.value)}
                className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-(--primary)"
              >
                {GRANULARITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          }
        >
          <SalesComparisonChart points={points} metric={metric} />
        </ChartCard>
      </div>

      {/* 2. Sales volume analysis */}
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Sales Volume Analysis"
          subtitle="Units & orders (left) with average order value (right)"
          loading={trend.loading}
          error={trend.error}
          onRetry={trend.reload}
          isEmpty={trendIsEmpty}
          height={300}
        >
          <VolumeTrendChart points={points} />
        </ChartCard>

        {/* 5b. Acquisition mix */}
        <ChartCard
          title="New vs Returning"
          subtitle="Customers who ordered this period"
          loading={customers.loading}
          error={customers.error}
          onRetry={customers.reload}
          isEmpty={!customers.data?.active_customers}
          height={300}
        >
          <NewVsReturningChart
            newCount={customers.data?.new_ordering_customers}
            returningCount={customers.data?.returning_customers}
          />
        </ChartCard>
      </div>

      {/* 3. Product performance */}
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Product Performance</h2>
            <p className="text-xs text-neutral-500">Compared against the previous equivalent period.</p>
          </div>
          <Link href="/dashboard/admin/products" className="text-sm font-medium text-(--primary) hover:underline">
            Product management
          </Link>
        </div>
        <ProductMoversTable query={query} queryKey={key} />
      </div>

      {/* 4. Category performance */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Revenue by Category"
          loading={categories.loading}
          error={categories.error}
          onRetry={categories.reload}
          isEmpty={!(categories.data?.results ?? []).length}
          height={280}
        >
          <CategoryBarChart data={categories.data?.results} dataKey="net_sales" />
        </ChartCard>
        <ChartCard
          title="Units Sold by Category"
          loading={categories.loading}
          error={categories.error}
          onRetry={categories.reload}
          isEmpty={!(categories.data?.results ?? []).length}
          height={280}
        >
          <CategoryBarChart data={categories.data?.results} dataKey="units_sold" formatValue={formatNumber} />
        </ChartCard>
      </div>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">Category Breakdown</h2>
          <select
            value={categorySort}
            onChange={(event) => setCategorySort(event.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
          >
            <option value="revenue">Sort by net sales</option>
            <option value="units">Sort by units sold</option>
            <option value="orders">Sort by orders</option>
          </select>
        </div>
        {categories.loading ? (
          <p className="py-6 text-center text-sm text-neutral-500">Loading…</p>
        ) : categories.error ? (
          <p className="py-6 text-center text-sm text-red-600">{categories.error}</p>
        ) : (categories.data?.results ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-500">No category sales in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500">
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Parent</th>
                  <th className="px-4 py-3 font-medium">Products</th>
                  <th className="px-4 py-3 font-medium">Units</th>
                  <th className="px-4 py-3 font-medium">Orders</th>
                  <th className="px-4 py-3 font-medium">Gross</th>
                  <th className="px-4 py-3 font-medium">Net</th>
                  <th className="px-4 py-3 font-medium">Share</th>
                  <th className="px-4 py-3 font-medium">Incl. subcats</th>
                </tr>
              </thead>
              <tbody>
                {categories.data.results.map((category) => (
                  <tr key={category.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded border border-neutral-200 bg-neutral-50">
                          {category.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={category.image} alt={category.name} className="h-full w-full object-cover" />
                          ) : (
                            <FiGrid size={12} className="text-neutral-300" />
                          )}
                        </span>
                        {category.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{category.parent_name || "—"}</td>
                    <td className="px-4 py-3 text-neutral-600">{category.product_count}</td>
                    <td className="px-4 py-3 text-neutral-600">{category.units_sold}</td>
                    <td className="px-4 py-3 text-neutral-600">{category.orders}</td>
                    <td className="px-4 py-3 text-neutral-600">{formatBDT(category.gross_sales)}</td>
                    <td className="px-4 py-3 font-medium text-neutral-900">{formatBDT(category.net_sales)}</td>
                    <td className="px-4 py-3 text-neutral-600">{category.contribution_pct}%</td>
                    <td className="px-4 py-3 text-neutral-500">{formatBDT(category.rollup_net_sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5a. Order status over time + customer growth */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Order Status Over Time"
          subtitle="Orders created, split by status"
          loading={trend.loading}
          error={trend.error}
          onRetry={trend.reload}
          isEmpty={trendIsEmpty}
          height={280}
        >
          <OrdersTrendChart points={points} />
        </ChartCard>

        <ChartCard
          title="Customer Growth"
          subtitle="New registered customers"
          loading={customers.loading}
          error={customers.error}
          onRetry={customers.reload}
          isEmpty={!customers.data?.growth?.length}
          height={280}
        >
          <CustomerGrowthChart points={customers.data?.growth ?? []} />
        </ChartCard>
      </div>

      {/* 6. Period comparison */}
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-neutral-900">Period Comparison</h2>
          <p className="text-xs text-neutral-500">Absolute and percentage change vs the previous equivalent period.</p>
        </div>
        {summary.loading ? (
          <p className="py-6 text-center text-sm text-neutral-500">Loading…</p>
        ) : (
          <PeriodComparisonTable items={comparisonItems} />
        )}
      </div>
    </div>
  );
}
