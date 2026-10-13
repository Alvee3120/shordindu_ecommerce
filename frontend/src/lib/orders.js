// lib/orders.js
import { apiFetch } from "./api";

export function listOrders({ page, status, payment_status, search, placed_after, placed_before, mine } = {}) {
  const params = new URLSearchParams();
  if (page) params.set("page", page);
  if (status) params.set("status", status);
  if (payment_status) params.set("payment_status", payment_status);
  if (search) params.set("search", search);
  if (placed_after) params.set("placed_after", placed_after);
  if (placed_before) params.set("placed_before", placed_before);
  if (mine) params.set("mine", "true");
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

// Order status transitions (CCE and admin).
export function confirmOrder(id) {
  return apiFetch(`/orders/${id}/confirm/`, { method: "POST" });
}

export function processOrder(id) {
  return apiFetch(`/orders/${id}/process/`, { method: "POST" });
}

export function cancelOrder(id) {
  return apiFetch(`/orders/${id}/cancel/`, { method: "POST" });
}

export function shipOrder(id) {
  return apiFetch(`/orders/${id}/ship/`, { method: "POST" });
}

export function deliverOrder(id) {
  return apiFetch(`/orders/${id}/deliver/`, { method: "POST" });
}

/**
 * Every status action, keyed by the status it results in (must match
 * Order.Status on the backend). Shared by the order modal and details page.
 * Cancelling releases the order's stock; moving a cancelled order back to an
 * active status re-reserves it (the backend rejects it if stock ran out).
 */
export const ORDER_STATUS_ACTIONS = [
  { label: "Confirm", value: "confirmed", action: confirmOrder },
  { label: "Process", value: "processing", action: processOrder },
  { label: "Ship", value: "shipped", action: shipOrder },
  { label: "Mark delivered", value: "delivered", action: deliverOrder },
  { label: "Cancel", value: "cancelled", action: cancelOrder },
];

/** Name to show for an order: account name, else the delivery name, else the guest email. */
export function orderCustomerName(order) {
  return order.user_name || order.shipping_address_detail?.name || order.guest_email || "Guest";
}

/**
 * CCE/admin "Add Order". Prices, stock, delivery and discount are all
 * recalculated server-side; `client_request_id` makes retries/double-clicks
 * return the first order instead of creating another.
 */
export function createManualOrder(payload) {
  return apiFetch("/orders/manual/", { method: "POST", body: payload });
}

/** Server-calculated totals for a draft dashboard order (writes nothing). */
export function quoteManualOrder(payload) {
  return apiFetch("/orders/quote/", { method: "POST", body: payload });
}
