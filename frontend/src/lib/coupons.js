// lib/coupons.js
import { apiFetch } from "./api";

export async function listCoupons() {
  const data = await apiFetch("/coupons/", { method: "GET" });
  return data.results;
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
