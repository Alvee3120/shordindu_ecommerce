// Admin/CCE old-cart monitoring endpoints.
import { apiFetch } from "./api";

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, value);
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** One row per customer whose active cart has an item older than 6 hours. */
export function listOldCarts({ page, search, age, ordering } = {}) {
  return apiFetch(`/cart/old/${buildQuery({ page, search, age, ordering })}`, {
    method: "GET",
  });
}

export function getOldCartsSummary() {
  return apiFetch("/cart/old/summary/", { method: "GET" });
}

export function getOldCart(id) {
  return apiFetch(`/cart/old/${id}/`, { method: "GET" });
}
