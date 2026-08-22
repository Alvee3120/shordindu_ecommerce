// lib/cart.js
import { apiFetch } from "./api";

export function getCart() {
  return apiFetch("/cart/", { method: "GET" });
}

export function addCartItem({ product, variation, quantity }) {
  return apiFetch("/cart/items/", { method: "POST", body: { product, variation, quantity } });
}

/** Attaches an addon (itself a product+variation) to an existing parent cart item. */
export function addCartItemAddon(parentCartItemId, { product, variation, quantity }) {
  return apiFetch(`/cart/items/${parentCartItemId}/addons/`, {
    method: "POST",
    body: { product, variation, quantity },
  });
}

export function updateCartItem(id, { quantity }) {
  return apiFetch(`/cart/items/${id}/`, { method: "PATCH", body: { quantity } });
}

export function deleteCartItem(id) {
  return apiFetch(`/cart/items/${id}/`, { method: "DELETE" });
}