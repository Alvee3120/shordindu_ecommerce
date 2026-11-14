"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FiSearch, FiUsers, FiUserPlus, FiUserCheck, FiRepeat } from "react-icons/fi";
import RangeFilter from "@/components/admin/analytics/RangeFilter";
import KpiCard from "@/components/admin/analytics/KpiCard";
import ChartCard from "@/components/admin/analytics/ChartCard";
import { CustomerGrowthChart } from "@/components/admin/analytics/charts";
import { useAnalyticsRange } from "@/components/admin/analytics/AnalyticsRangeContext";
import { useAnalyticsResource } from "@/components/admin/analytics/useAnalyticsResource";
import { getCustomerSummary, getCustomers } from "@/lib/analytics";
import { formatBDT, formatDate } from "@/lib/format";

const PAGE_SIZE = 20;

export default function AdminCustomersPage() {
  const { query, label, isReady } = useAnalyticsRange();
  const key = JSON.stringify(query);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState("-total_spend");

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const summary = useAnalyticsResource(() => getCustomerSummary(query), [key], { enabled: isReady });

  const [table, setTable] = useState({ results: [], count: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isReady) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCustomers({ ...query, page, search: search || undefined, ordering })
      .then((data) => {
        if (!cancelled) setTable({ results: data.results, count: data.count });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          toast.error(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, page, search, ordering, isReady]);

  const totalPages = Math.max(1, Math.ceil(table.count / PAGE_SIZE));
  const newChange = summary.data?.new_customers?.change_pct;

  return (
    <div className="pb-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Customers</h1>
          <p className="mt-1 text-sm text-neutral-500">Customer analytics for {label}</p>
        </div>
        <RangeFilter />
      </div>

      {summary.error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{summary.error}</p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Total Customers"
          icon={FiUsers}
          loading={summary.loading}
          value={summary.data?.total_customers ?? "—"}
        />
        <KpiCard
          label="New Customers"
          icon={FiUserPlus}
          loading={summary.loading}
          changePct={newChange}
          value={summary.data?.new_customers?.value ?? "—"}
          tooltip="Customer accounts registered during the selected period."
        />
        <KpiCard
          label="Active Customers"
          icon={FiUserCheck}
          loading={summary.loading}
          value={summary.data?.active_customers ?? "—"}
          tooltip="Distinct customers who placed at least one order in the period."
        />
        <KpiCard
          label="Repeat Customers"
          icon={FiRepeat}
          loading={summary.loading}
          value={summary.data?.repeat_customers ?? "—"}
          tooltip="Customers with more than one order in total."
        />
      </div>

      <div className="mt-6">
        <ChartCard
          title="Customer Growth"
          subtitle="New registrations over time"
          loading={summary.loading}
          error={summary.error}
          onRetry={summary.reload}
          isEmpty={!summary.data?.growth?.length}
          height={260}
        >
          <CustomerGrowthChart points={summary.data?.growth ?? []} />
        </ChartCard>
      </div>

      <div className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative">
            <FiSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search name, email or phone"
              className="w-64 rounded-lg border border-neutral-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
            />
          </div>
          <select
            value={ordering}
            onChange={(event) => {
              setOrdering(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
          >
            <option value="-total_spend">Sort by spend (high to low)</option>
            <option value="-total_orders">Sort by orders (high to low)</option>
            <option value="-last_order_at">Sort by last order</option>
            <option value="name">Sort by name</option>
            <option value="-created_at">Sort by registration</option>
          </select>
        </div>

        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Phone</th>
                <th className="px-5 py-3 font-medium">Registered</th>
                <th className="px-5 py-3 font-medium">Orders</th>
                <th className="px-5 py-3 font-medium">Total Spend</th>
                <th className="px-5 py-3 font-medium">Last Order</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-neutral-500">Loading…</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-red-600">{error}</td>
                </tr>
              ) : table.results.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-neutral-500">No customers found.</td>
                </tr>
              ) : (
                table.results.map((customer) => (
                  <tr key={customer.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-5 py-3">
                      <span className="block font-medium text-neutral-900">{customer.name}</span>
                      <span className="text-xs text-neutral-500">{customer.email}</span>
                    </td>
                    <td className="px-5 py-3 text-neutral-600">{customer.phone || "—"}</td>
                    <td className="px-5 py-3 text-neutral-500">{formatDate(customer.created_at)}</td>
                    <td className="px-5 py-3 text-neutral-600">{customer.total_orders}</td>
                    <td className="px-5 py-3 font-medium text-neutral-900">{formatBDT(customer.total_spend)}</td>
                    <td className="px-5 py-3 text-neutral-500">{formatDate(customer.last_order_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3 text-sm">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-40"
            >
              Prev
            </button>
            <span className="text-neutral-500">Page {page} of {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
