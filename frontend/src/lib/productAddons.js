// lib/productAddons.js
import { apiFetch } from "./api";

export async function listProductAddons() {
  const data = await apiFetch("/product-addons/", { method: "GET" });
  return data.results;
}

export function createProductAddon(payload) {
  return apiFetch("/product-addons/", { method: "POST", body: payload });
}

export function updateProductAddon(id, payload) {
  return apiFetch(`/product-addons/${id}/`, { method: "PATCH", body: payload });
}

export function deleteProductAddon(id) {
  return apiFetch(`/product-addons/${id}/`, { method: "DELETE" });
}
