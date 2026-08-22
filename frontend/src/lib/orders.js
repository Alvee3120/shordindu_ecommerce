// lib/orders.js
import { apiFetch } from "./api";

export function listOrders({ page, status, payment_status } = {}) {
  const params = new URLSearchParams();
  if (page) params.set("page", page);
  if (status) params.set("status", status);
  if (payment_status) params.set("payment_status", payment_status);
  const query = params.toString();
  return apiFetch(`/orders/${query ? `?${query}` : ""}`, { method: "GET" });
}

export function getOrder(id) {
  return apiFetch(`/orders/${id}/`, { method: "GET" });
}

/**
 * Places the order for whatever's in the current cart (cash on delivery is
 * the only payment method the backend supports, so there's no method field).
 * Pass shipping_address_id for a saved address, or the shipping_* inline
 * fields (+ email for a guest) to ship somewhere new.
 */
export function checkout(payload) {
  return apiFetch("/checkout/", { method: "POST", body: payload });
}
