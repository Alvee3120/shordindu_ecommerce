"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FiBox } from "react-icons/fi";
import StatusBadge from "@/components/admin/StatusBadge";
import { getProductPerformance } from "@/lib/analytics";
import { formatBDT, formatNumber } from "@/lib/format";

const TABS = [
  { key: "quantity", label: "Best by quantity", params: { ordering: "-units_sold" } },
  { key: "revenue", label: "Best by revenue", params: { ordering: "-revenue" } },
  { key: "growing", label: "Growing", params: { movers: "growing" } },
  { key: "declining", label: "Declining", params: { movers: "declining" } },
];

export default function ProductMoversTable({ query, queryKey, pageSize = 8 }) {
  const [tab, setTab] = useState("quantity");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = TABS.find((item) => item.key === tab)?.params ?? {};
    getProductPerformance({ ...query, compare: 1, page_size: pageSize, ...params })
      .then((data) => {
        if (!cancelled) setRows(data.results);
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
  }, [queryKey, tab, pageSize]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-neutral-100 p-1">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              tab === item.key ? "bg-white text-(--primary) shadow-sm" : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-500">
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Units</th>
              <th className="px-4 py-3 font-medium">Prev. units</th>
              <th className="px-4 py-3 font-medium">Δ units</th>
              <th className="px-4 py-3 font-medium">Revenue</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">Loading…</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-red-600">{error}</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                  No products with sales in this period.
                </td>
              </tr>
            ) : (
              rows.map((product) => {
                const delta = Number(product.delta_units ?? 0);
                return (
                  <tr key={product.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      <Link href={`/dashboard/admin/products/${product.id}`} className="flex items-center gap-2 hover:text-(--primary)">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded border border-neutral-200 bg-neutral-50">
                          {product.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                          ) : (
                            <FiBox size={12} className="text-neutral-300" />
                          )}
                        </span>
                        <span className="min-w-0 truncate">{product.name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{formatNumber(product.units_sold)}</td>
                    <td className="px-4 py-3 text-neutral-500">{formatNumber(product.prev_units_sold ?? 0)}</td>
                    <td className={`px-4 py-3 font-medium ${delta === 0 ? "text-neutral-400" : delta > 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {delta > 0 ? "+" : ""}
                      {formatNumber(delta)}
                    </td>
                    <td className="px-4 py-3 font-medium text-neutral-900">{formatBDT(product.revenue)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={product.status} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
