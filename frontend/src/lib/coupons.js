// lib/coupons.js
// Admins get full CRUD; CCE users are read-only (the backend enforces this —
// writes from a CCE session return 403).
import { apiFetch } from "./api";

/** Paginated `{count, next, previous, results}`; filters: search (code), type, status. */
export function listCoupons({ page, search, type, status } = {}) {
  const params = new URLSearchParams();
  if (page) params.set("page", page);
  if (search) params.set("search", search);
  if (type) params.set("type", type);
  if (status) params.set("status", status);
  const query = params.toString();
  return apiFetch(`/coupons/${query ? `?${query}` : ""}`, { method: "GET" });
}

export function getCoupon(id) {
  return apiFetch(`/coupons/${id}/`, { method: "GET" });
}

export function createCoupon(payload) {
  return apiFetch("/coupons/", { method: "POST", body: payload });
}

export function updateCoupon(id, payload) {
  return apiFetch(`/coupons/${id}/`, { method: "PATCH", body: payload });
}

export function deleteCoupon(id) {
  return apiFetch(`/coupons/${id}/`, { method: "DELETE" });
}
