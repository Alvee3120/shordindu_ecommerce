// lib/products.js
import { apiFetch, API_BASE_URL } from "./api";

export function listProducts({
  page,
  page_size,
  search,
  category,
  colors,
  min_price,
  max_price,
  ordering,
  status,
  discount,
} = {}) {
  const params = new URLSearchParams();
  if (page) params.set("page", page);
  if (page_size) params.set("page_size", page_size);
  if (search) params.set("search", search);
  if (category) params.set("category", category);
  if (colors) params.set("color", colors);
  if (min_price != null && min_price !== "") params.set("min_price", min_price);
  if (max_price != null && max_price !== "") params.set("max_price", max_price);
  if (ordering) params.set("ordering", ordering);
  if (status) params.set("status", status);
  if (discount) params.set("discount", discount);
  const query = params.toString();
  return apiFetch(`/products/${query ? `?${query}` : ""}`, { method: "GET" });
}

/** Color choices with product counts for the shop filter. */
export function getColorFacets({ category, min_price, max_price, search, discount } = {}) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (min_price != null && min_price !== "") params.set("min_price", min_price);
  if (max_price != null && max_price !== "") params.set("max_price", max_price);
  if (search) params.set("search", search);
  if (discount) params.set("discount", discount);
  const query = params.toString();
  return apiFetch(`/products/color-facets/${query ? `?${query}` : ""}`, { method: "GET" });
}

/** "SAVE 20%" / "SAVE ৳300" for an automatic discount (API `discount` object). */
export function discountLabel(discount) {
  if (!discount) return null;
  const value = Number(discount.value);
  const shown = Number.isInteger(value) ? value : value.toFixed(2);
  return discount.type === "percent" ? `SAVE ${shown}%` : `SAVE ৳${shown}`;
}

/**
 * What a customer pays for a variation right now. `variation.price` is the
 * base price; the backend adds `effective_price` + `discount` when an
 * automatic discount is live (it re-prices again at checkout).
 * Returns { price, originalPrice (null unless discounted), discountLabel }.
 */
export function variationPricing(variation) {
  if (!variation) return { price: null, originalPrice: null, discountLabel: null };
  const current = Number(variation.effective_price ?? variation.price);
  const references = [Number(variation.price), Number(variation.compare_at_price)]
    .filter((value) => Number.isFinite(value) && value > current)
    .sort((a, b) => b - a);
  const originalPrice = references[0] ?? null;
  const savePercent =
    originalPrice != null && originalPrice > 0
      ? Math.round(100 - (current / originalPrice) * 100)
      : null;
  return {
    price: variation.effective_price ?? variation.price,
    originalPrice,
    discountLabel:
      savePercent != null ? `SAVE ${savePercent}%` : discountLabel(variation.discount),
  };
}

function variationColorIds(variation) {
  return (variation.attribute_values || []).map((value) => value.attribute_value);
}

function isColorAttributeName(name) {
  return ["color", "colour"].includes((name || "").trim().toLowerCase());
}

/** True for white-ish colors that need a visible border on light backgrounds. */
export function isLightColor(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex || "");
  if (!match) return true;
  const value = parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 200;
}

function lowestPricedVariation(variations) {
  const priced = variations
    .map((variation) => ({ variation, pricing: variationPricing(variation) }))
    .filter((entry) => entry.pricing.price != null);
  return priced.sort((a, b) => Number(a.pricing.price) - Number(b.pricing.price))[0] || null;
}

/** Flattens a raw API product into the shape ProductCard/SearchBar expect. */
export function toCardProduct(product) {
  const images = product.images || [];
  const primaryImage =
    images.find((image) => image.is_primary)?.image || images[0]?.image || null;
  const variations = product.variations || [];
  const hasColorVariations = variations.some((variation) =>
    (variation.attribute_values || []).some((value) =>
      isColorAttributeName(value.attribute)
    )
  );

  const colors = (product.colors || [])
    .filter((color) => color.is_active !== false)
    .map((color) => {
      const matching = variations.filter((variation) =>
        variationColorIds(variation).includes(color.attribute_value)
      );
      // When colors live on variations, a color with no matching variation
      // must not fall back to another variation (that would add the wrong color).
      const pool = matching.length > 0 ? matching : hasColorVariations ? [] : variations;
      const inStockPool = pool.filter((variation) => Number(variation.stock_quantity) > 0);
      const pricingPool = inStockPool.length > 0 ? inStockPool : pool;
      const best = lowestPricedVariation(pricingPool);
      const variationImage =
        matching.flatMap((variation) => variation.images || [])[0]?.image || null;
      return {
        ...color,
        image: color.image_url || variationImage,
        price: best?.pricing.price ?? null,
        originalPrice: best?.pricing.originalPrice ?? null,
        discountLabel: best?.pricing.discountLabel ?? null,
        variationId: best?.variation.id ?? null,
        stock: pool.reduce(
          (highest, variation) => Math.max(highest, Number(variation.stock_quantity) || 0),
          0
        ),
        inStock: pool.some((variation) => Number(variation.stock_quantity) > 0),
      };
    });

  const fallbackPricing = variationPricing(variations[0]);
  const hasAddons = Boolean(product.has_addons);
  const hasVariationAttributes = variations.some(
    (variation) => (variation.attribute_values || []).length > 0
  );
  const hasNonColorAttribute = variations.some((variation) =>
    (variation.attribute_values || []).some(
      (value) => !isColorAttributeName(value.attribute)
    )
  );
  const hasOptions =
    product.product_type === "variable" ||
    variations.length > 1 ||
    hasVariationAttributes ||
    hasAddons ||
    colors.length > 0;
  // Colors are selectable on the card, so a color-only product (no sizes,
  // add-ons or other required choices) can be added straight to the cart.
  const quickAdd =
    !hasAddons &&
    variations.length > 0 &&
    !hasNonColorAttribute &&
    (colors.length > 0 || !hasVariationAttributes);
  const stock = Number(variations[0]?.stock_quantity) || 0;

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    image: primaryImage,
    price: fallbackPricing.price,
    originalPrice: fallbackPricing.originalPrice,
    discountLabel: fallbackPricing.discountLabel,
    discountId: variations[0]?.discount?.id ?? null,
    discountName: variations[0]?.discount?.name ?? null,
    rating: product.average_rating ?? 0,
    reviewCount: product.review_count ?? 0,
    colors,
    hasOptions,
    hasAddons,
    quickAdd,
    isSimple: !hasOptions && variations.length <= 1,
    variationId: variations[0]?.id ?? null,
    stock,
    inStock: stock > 0,
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

export function createProductImage({ product, image, variation, alt_text, is_primary, sort_order }) {
  const form = new FormData();
  form.append("product", product);
  form.append("image", image);
  if (variation) form.append("variation", variation);
  if (alt_text) form.append("alt_text", alt_text);
  if (is_primary) form.append("is_primary", "true");
  if (sort_order != null) form.append("sort_order", sort_order);
  return apiFetch("/product-images/", { method: "POST", body: form, isFormData: true });
}

export function deleteProductImage(id) {
  return apiFetch(`/product-images/${id}/`, { method: "DELETE" });
}

export function createProductColor({ product, name, hex_code, image, is_active, sort_order }) {
  const form = new FormData();
  form.append("product", product);
  form.append("name", name);
  form.append("hex_code", hex_code || "");
  form.append("is_active", String(Boolean(is_active)));
  if (image) form.append("image", image);
  if (sort_order != null) form.append("sort_order", sort_order);
  return apiFetch("/product-colors/", { method: "POST", body: form, isFormData: true });
}

export function updateProductColor(id, { name, hex_code, image, remove_image, is_active, sort_order }) {
  const form = new FormData();
  if (name != null) form.append("name", name);
  if (hex_code != null) form.append("hex_code", hex_code);
  if (image) form.append("image", image);
  if (remove_image) form.append("remove_image", "true");
  if (is_active != null) form.append("is_active", String(Boolean(is_active)));
  if (sort_order != null) form.append("sort_order", sort_order);
  return apiFetch(`/product-colors/${id}/`, {
    method: "PATCH",
    body: form,
    isFormData: true,
  });
}

export function deleteProductColor(id) {
  return apiFetch(`/product-colors/${id}/`, { method: "DELETE" });
}

/** Reusable global colors, with a count of how many products use each. */
export function listColorLibrary({ search } = {}) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  const query = params.toString();
  return apiFetch(`/attribute-values/color-library/${query ? `?${query}` : ""}`, {
    method: "GET",
  });
}

export function listProductColors({ product, page_size = 100 } = {}) {
  const params = new URLSearchParams({ page_size: String(page_size) });
  if (product) params.set("product", product);
  return apiFetch(`/product-colors/?${params.toString()}`, { method: "GET" });
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
