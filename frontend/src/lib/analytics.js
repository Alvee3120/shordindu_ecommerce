// lib/analytics.js — admin-only dashboard analytics endpoints.
import { apiFetch, API_BASE_URL } from "./api";

/** Builds a query string from a plain object, skipping empty values. */
function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, value);
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function getSummary(range) {
  return apiFetch(`/analytics/summary/${buildQuery(range)}`, { method: "GET" });
}

export function getSalesTrend(range, { metric, granularity } = {}) {
  return apiFetch(`/analytics/sales-trend/${buildQuery({ ...range, metric, granularity })}`, {
    method: "GET",
  });
}

export function getOrderStatus(range) {
  return apiFetch(`/analytics/order-status/${buildQuery(range)}`, { method: "GET" });
}

export function getTopProducts(range, { sort, limit } = {}) {
  return apiFetch(`/analytics/top-products/${buildQuery({ ...range, sort, limit })}`, {
    method: "GET",
  });
}

export function getCategorySales(range, { sort } = {}) {
  return apiFetch(`/analytics/categories/${buildQuery({ ...range, sort })}`, { method: "GET" });
}

export function getProductPerformance({ page, page_size, search, status, category, ordering, ...range } = {}) {
  return apiFetch(
    `/analytics/products/${buildQuery({ ...range, page, page_size, search, status, category, ordering })}`,
    { method: "GET" }
  );
}

export function getCustomerSummary(range) {
  return apiFetch(`/analytics/customers/summary/${buildQuery(range)}`, { method: "GET" });
}

export function getCustomers({ page, search, ordering, ...range } = {}) {
  return apiFetch(
    `/analytics/customers/${buildQuery({ ...range, page, search, ordering })}`,
    { method: "GET" }
  );
}

export function getRecentOrders(range, { scope, limit } = {}) {
  return apiFetch(`/analytics/recent-orders/${buildQuery({ ...range, scope, limit })}`, {
    method: "GET",
  });
}

/** Downloads a CSV export (cookie-authenticated) and triggers a browser save. */
export async function downloadCsv(range, dataset) {
  const res = await fetch(`${API_BASE_URL}/analytics/export/${buildQuery({ ...range, dataset })}`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("Could not export this report. Please try again.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${dataset}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
