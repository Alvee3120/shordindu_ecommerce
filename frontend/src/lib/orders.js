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
