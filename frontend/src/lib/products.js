// lib/products.js
import { apiFetch, API_BASE_URL } from "./api";

export function listProducts({
  page,
  page_size,
  search,
  category,
  visibility_type,
  min_price,
  max_price,
  ordering,
} = {}) {
  const params = new URLSearchParams();
  if (page) params.set("page", page);
  if (page_size) params.set("page_size", page_size);
  if (search) params.set("search", search);
  if (category) params.set("category", category);
  if (visibility_type) params.set("visibility_type", visibility_type);
  if (min_price != null && min_price !== "") params.set("min_price", min_price);
  if (max_price != null && max_price !== "") params.set("max_price", max_price);
  if (ordering) params.set("ordering", ordering);
  const query = params.toString();
  return apiFetch(`/products/${query ? `?${query}` : ""}`, { method: "GET" });
}

/** Flattens a raw API product into the shape ProductCard/SearchBar expect. */
export function toCardProduct(product) {
  const primaryImage =
    product.images?.find((i) => i.is_primary)?.image || product.images?.[0]?.image || null;
  const firstVariation = product.variations?.[0];
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    image: primaryImage,
    price: firstVariation?.price ?? null,
    rating: product.average_rating ?? 0,
    reviewCount: product.review_count ?? 0,
    variationId: firstVariation?.id ?? null,
    inStock: (firstVariation?.stock_quantity ?? 0) > 0,
    href: `/shop/${product.id}`,
  };
}

export function getProduct(id) {
  return apiFetch(`/products/${id}/`, { method: "GET" });
}

export function getProductAddons(id) {
  return apiFetch(`/products/${id}/addons/`, { method: "GET" });
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

export function bulkImportProducts(file) {
  const form = new FormData();
  form.append("file", file);
  return apiFetch("/products/bulk-import/", { method: "POST", body: form, isFormData: true });
}

/** Downloads the .xlsx bulk-import template and saves it via the browser. */
export async function downloadImportTemplate() {
  const res = await fetch(`${API_BASE_URL}/products/import-template/`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("Could not download the import template. Please try again.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "product_import_template.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
