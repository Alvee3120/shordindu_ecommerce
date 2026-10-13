// lib/delivery.js — admin-configured delivery charges.
//
// The amounts AND the Dhaka zone -> tier rules both come from
// GET /delivery-charges/ (backend apps/orders/pricing.py is the source of
// truth), so nothing here hardcodes a fee. The backend recalculates the fee
// when an order is placed; these helpers only drive what the customer sees.
import { apiFetch } from "./api";

export function getDeliveryCharges() {
  return apiFetch("/delivery-charges/", { method: "GET" });
}

export function updateDeliveryCharges({ inside_dhaka, dhaka_outer_zones, outside_dhaka }) {
  return apiFetch("/delivery-charges/", {
    method: "PUT",
    body: { inside_dhaka, dhaka_outer_zones, outside_dhaka },
  });
}

export function isDhaka(config, district) {
  if (!config || !district) return false;
  return district.trim().toLowerCase() === config.dhaka_district.toLowerCase();
}

/**
 * Resolves the delivery charge for a district (+ Dhaka zone).
 * Returns { fee, tier, label } or null while it can't be priced yet — no
 * district, or Dhaka without a valid zone selected.
 */
export function resolveDeliveryCharge(config, district, zone) {
  if (!config || !district) return null;
  let tier = "outside_dhaka";
  if (isDhaka(config, district)) {
    tier = config.dhaka_zones.find((z) => z.name === zone)?.tier;
    if (!tier) return null;
  }
  return { fee: Number(config[tier]), tier, label: config.tier_labels[tier] };
}
