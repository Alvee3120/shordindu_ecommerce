// lib/products.js
import { apiFetch } from "./api";

export function listProducts({ page, page_size, search, category } = {}) {
  const params = new URLSearchParams();
  if (page) params.set("page", page);
  if (page_size) params.set("page_size", page_size);
  if (search) params.set("search", search);
  if (category) params.set("category", category);
  const query = params.toString();
  return apiFetch(`/products/${query ? `?${query}` : ""}`, { method: "GET" });
}

export function getProduct(id) {
  return apiFetch(`/products/${id}/`, { method: "GET" });
}

export function createProduct(payload) {
  return apiFetch("/products/", { method: "POST", body: payload });
}

export function updateProduct(id, payload) {
  return apiFetch(`/products/${id}/`, { method: "PATCH", body: payload });
}

export function deleteProduct(id) {
  return apiFetch(`/products/${id}/`, { method: "DELETE" });
}

export function createProductVariation(payload) {
  return apiFetch("/product-variations/", { method: "POST", body: payload });
}

export function updateProductVariation(id, payload) {
  return apiFetch(`/product-variations/${id}/`, { method: "PATCH", body: payload });
}

export function deleteProductVariation(id) {
  return apiFetch(`/product-variations/${id}/`, { method: "DELETE" });
}

export function addProductAttributeValue({ product, attribute_value }) {
  return apiFetch("/product-attribute-values/", {
    method: "POST",
    body: { product, attribute_value },
  });
}

export function removeProductAttributeValue(id) {
  return apiFetch(`/product-attribute-values/${id}/`, { method: "DELETE" });
}

export function createProductImage({ product, image, alt_text, is_primary, sort_order }) {
  const form = new FormData();
  form.append("product", product);
  form.append("image", image);
  if (alt_text) form.append("alt_text", alt_text);
  if (is_primary) form.append("is_primary", "true");
  if (sort_order != null) form.append("sort_order", sort_order);
  return apiFetch("/product-images/", { method: "POST", body: form, isFormData: true });
}

export function deleteProductImage(id) {
  return apiFetch(`/product-images/${id}/`, { method: "DELETE" });
}
