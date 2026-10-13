// lib/discounts.js — automatic category/product discounts (admin only).
// Separate from coupons (lib/coupons.js), which customers type in at checkout.
import { apiFetch } from "./api";

/** Paginated `{count, results}`; filters: search, status, type, target_type. */
export function listDiscounts({ page, search, status, type, target_type } = {}) {
  const params = new URLSearchParams();
  if (page) params.set("page", page);
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  if (type) params.set("type", type);
  if (target_type) params.set("target_type", target_type);
  const query = params.toString();
  return apiFetch(`/discounts/${query ? `?${query}` : ""}`, { method: "GET" });
}

export function getDiscount(id) {
  return apiFetch(`/discounts/${id}/`, { method: "GET" });
}

export function createDiscount(payload) {
  return apiFetch("/discounts/", { method: "POST", body: payload });
}

export function updateDiscount(id, payload) {
  return apiFetch(`/discounts/${id}/`, { method: "PATCH", body: payload });
}

export function deleteDiscount(id) {
  return apiFetch(`/discounts/${id}/`, { method: "DELETE" });
}

// How long the homepage may serve cached discount sections before
// re-checking — bounds how quickly a discount's start/end or an admin edit shows.
export const SHOWCASE_REVALIDATE_SECONDS = 60;

/**
 * Public: live discounts, each with the products it currently prices (already
 * carrying their effective prices). Discounts without products are omitted.
 * Returns [] if the backend can't be reached, so the homepage still renders.
 */
export async function getDiscountShowcases() {
  try {
    const data = await apiFetch("/discount-showcases/", {
      method: "GET",
      next: { revalidate: SHOWCASE_REVALIDATE_SECONDS },
    });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** "20%" or "৳200 OFF" — how a discount's value is shown in lists. */
export function formatDiscountValue(discount) {
  const value = Number(discount.value);
  const shown = Number.isInteger(value) ? value.toLocaleString("en-US") : value.toFixed(2);
  return discount.type === "percent" ? `${shown}%` : `৳${shown} OFF`;
}
