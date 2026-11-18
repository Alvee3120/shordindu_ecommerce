// lib/discounts.js — automatic category/product discounts (admin only).
// Separate from coupons (lib/coupons.js), which customers type in at checkout.
import { apiFetch } from "./api";
import { formatBDT } from "./format";

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

/**
 * Fired after any admin discount mutation (create / edit / activate / delete).
 * The homepage discount section listens for it on both `window` (same tab) and
 * a BroadcastChannel (other tabs) and refetches immediately.
 */
export const DISCOUNTS_CHANGED_EVENT = "shordindu:discounts-changed";
export const DISCOUNTS_CHANNEL = "shordindu:discounts";

export function notifyDiscountsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DISCOUNTS_CHANGED_EVENT));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(DISCOUNTS_CHANNEL);
    channel.postMessage("changed");
    channel.close();
  }
}

/**
 * Public: live discounts, each with the products it currently prices (already
 * carrying their effective prices). Discounts without products are omitted.
 * Always fresh (`no-store`) — the homepage must reflect admin changes and
 * scheduled start/expiry without a reload.
 */
export async function getDiscountShowcases() {
  try {
    const data = await apiFetch("/discount-showcases/", {
      method: "GET",
      cache: "no-store",
    });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Every discount type the admin can create, grouped the way the editor offers
 * them. "Product price" types lower a single variation's price
 * (apps.catalog.pricing); "Cart offer" types are basket-level promotions
 * applied to a group of units in the cart/order (apps.catalog.promotions).
 */
export const DISCOUNT_TYPES = [
  { value: "percent", label: "Percentage off", group: "Product price" },
  { value: "fixed", label: "Fixed amount off", group: "Product price" },
  { value: "bxgy_percent", label: "Buy X, get Y% off", group: "Cart offer" },
  { value: "bxgy_free", label: "Buy X, get Y free", group: "Cart offer" },
  { value: "lowest_free", label: "Buy X, get cheapest free", group: "Cart offer" },
  { value: "three_for_two", label: "3 for 2", group: "Cart offer" },
  { value: "bundle_price", label: "Bundle for a fixed price", group: "Cart offer" },
  { value: "min_purchase", label: "Flat % off on minimum purchase", group: "Cart offer" },
];

export const DISCOUNT_TYPE_LABEL = Object.fromEntries(DISCOUNT_TYPES.map((t) => [t.value, t.label]));

/** DISCOUNT_TYPES bucketed by group, for <optgroup>-style pickers. */
export const DISCOUNT_TYPE_GROUPS = [...new Set(DISCOUNT_TYPES.map((t) => t.group))].map((group) => ({
  group,
  options: DISCOUNT_TYPES.filter((t) => t.group === group),
}));

/** Product-price types change a variation's price; the rest are cart offers. */
export function isBasketDiscount(type) {
  return type !== "percent" && type !== "fixed";
}

/** Flat percentage off once the eligible subtotal reaches a minimum. */
export function isMinimumPurchaseDiscount(type) {
  return type === "min_purchase";
}

/** How a discount's offer reads in lists: "20%", "৳200 OFF" or "Buy 3, get 20% off". */
export function formatDiscountValue(discount) {
  if (isBasketDiscount(discount.type)) return discount.label;
  const value = Number(discount.value);
  const shown = Number.isInteger(value) ? value.toLocaleString("en-US") : value.toFixed(2);
  return discount.type === "percent" ? `${shown}%` : `৳${shown} OFF`;
}

/**
 * Storefront progress of one minimum-purchase offer (see the cart API's
 * `minimum_purchase_offers`): "Spend ৳2,000 and get 10% OFF", "Add ৳500 more
 * to unlock 10% OFF!" or "Congratulations! You unlocked 10% OFF.".
 */
export function minimumPurchaseMessage(offer) {
  if (!offer) return null;
  const percent = `${Number(offer.percent_off)}%`;
  if (offer.qualified) return `Congratulations! You unlocked ${percent} OFF.`;
  const remaining = Number(offer.remaining);
  if (Number.isFinite(remaining) && remaining > 0) {
    return `Add ${formatBDT(remaining)} more to unlock ${percent} OFF!`;
  }
  return `Spend ${formatBDT(offer.min_purchase_amount)} and get ${percent} OFF.`;
}
