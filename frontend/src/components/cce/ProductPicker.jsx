"use client";

import { useEffect, useState } from "react";
import { FiBox, FiCheck, FiChevronDown, FiPlus, FiSearch } from "react-icons/fi";
import { getProduct, listProducts } from "@/lib/products";
import { formatBDT } from "@/lib/format";

const INITIAL_RESULTS = 5;
const EXPANDED_RESULTS = 20;

function primaryImage(product, variationId) {
  const images = product.images || [];
  return (
    images.find((img) => img.variation === variationId)?.image ||
    images.find((img) => img.is_primary)?.image ||
    images[0]?.image ||
    null
  );
}

export function variationLabel(variation) {
  const values = (variation.attribute_values || []).map((av) => av.value);
  return values.length ? values.join(" / ") : "Default";
}

function sellableVariations(product) {
  return (product.variations || []).filter((v) => v.is_active);
}

/** Flattens a product + variation into the line shape the Add Order page keeps. */
function toLine(product, variation) {
  return {
    variationId: variation.id,
    productId: product.id,
    name: product.name,
    variationLabel: product.product_type === "variable" ? variationLabel(variation) : "",
    sku: variation.sku,
    image: primaryImage(product, variation.id),
    // Current price incl. any live automatic discount (re-checked by the backend).
    unitPrice: Number(variation.effective_price ?? variation.price),
    stock: variation.stock_quantity,
  };
}

/**
 * Debounced product search: name / SKU (and exact product ID when the query
 * is a number), with image, price and stock for each result.
 *
 * Two modes:
 * - Order entry (`onAdd`, `quantityInOrder`): variable products expand so the
 *   exact variation is picked; only active products are offered.
 * - Product selection (`onSelectProduct`, `isProductSelected`): clicking a
 *   result selects the whole product (e.g. as a discount target).
 *
 * `status` filters by product status ("active" by default; null for all).
 * Prices and stock shown here are always re-validated by the backend.
 */
export default function ProductPicker({
  onAdd,
  quantityInOrder = () => 0,
  onSelectProduct,
  isProductSelected = () => false,
  status = "active",
}) {
  const selectMode = Boolean(onSelectProduct);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(INITIAL_RESULTS);
  const [results, setResults] = useState([]);
  const [resultsTerm, setResultsTerm] = useState("");
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const term = query.trim();
  // Results on screen belong to an older query until the debounced search lands.
  const pending = loading || resultsTerm !== term;

  const handleQueryChange = (value) => {
    setQuery(value);
    setLimit(INITIAL_RESULTS);
    setExpandedId(null);
  };

  // Debounced: the search runs 300ms after the CCE stops typing.
  useEffect(() => {
    if (!term) return undefined;
    let cancelled = false;
    const timeout = setTimeout(() => {
      setLoading(true);
      const byId = /^\d+$/.test(term) ? getProduct(term).catch(() => null) : Promise.resolve(null);
      Promise.all([listProducts({ search: term, page_size: limit, status: status || undefined }), byId])
        .then(([data, exact]) => {
          if (cancelled) return;
          let list = data.results;
          if (exact && (!status || exact.status === status) && !list.some((p) => p.id === exact.id)) {
            list = [exact, ...list];
          }
          setResults(list);
          setResultsTerm(term);
          setCount(data.count + (list.length > data.results.length ? 1 : 0));
          setError("");
        })
        .catch((err) => !cancelled && setError(err.message))
        .finally(() => !cancelled && setLoading(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [term, limit, status]);

  const handleProductClick = (product) => {
    if (selectMode) {
      onSelectProduct(product);
      return;
    }
    const variations = sellableVariations(product);
    if (variations.length === 1) {
      onAdd(toLine(product, variations[0]));
      return;
    }
    setExpandedId((prev) => (prev === product.id ? null : product.id));
  };

  return (
    <div>
      <div className="relative">
        <FiSearch size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search by product name, SKU or product ID..."
          aria-label="Search products"
          className="w-full rounded-lg border border-neutral-300 py-2.5 pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
        />
      </div>

      {term && (
        <div className="mt-2 overflow-hidden rounded-lg border border-neutral-200">
          {pending && (results.length === 0 || error) ? (
            <div className="animate-pulse space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-11 rounded bg-neutral-100" />
              ))}
            </div>
          ) : error ? (
            <p className="px-3 py-4 text-center text-sm text-red-600">{error}</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-neutral-500">
              No {status ? `${status} ` : ""}products match “{term}”.
            </p>
          ) : (
            <ul className={`divide-y divide-neutral-100 ${pending ? "opacity-60" : ""}`}>
              {results.map((product) => {
                const variations = sellableVariations(product);
                const totalStock = variations.reduce((s, v) => s + v.stock_quantity, 0);
                const prices = variations.map((v) => Number(v.effective_price ?? v.price));
                const priceText = prices.length
                  ? Math.min(...prices) === Math.max(...prices)
                    ? formatBDT(prices[0])
                    : `${formatBDT(Math.min(...prices))} – ${formatBDT(Math.max(...prices))}`
                  : "—";
                const single = variations.length === 1 ? variations[0] : null;
                const singleAtLimit = single && (quantityInOrder(single.id) >= single.stock_quantity);
                const selected = selectMode && isProductSelected(product);
                const disabled = selectMode
                  ? selected
                  : variations.length === 0 || totalStock === 0 || singleAtLimit;
                const image = primaryImage(product);
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => handleProductClick(product)}
                      disabled={disabled}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-(--primary)/5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={image} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <FiBox size={15} className="text-neutral-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900">{product.name}</p>
                        <p className="truncate text-xs text-neutral-500">
                          #{product.id} · {single ? single.sku : `${variations.length} variations`}
                          {product.status !== "active" && <span className="capitalize"> · {product.status}</span>}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-neutral-900">{priceText}</p>
                        <p className={`text-xs ${totalStock > 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {totalStock > 0 ? `${totalStock} in stock` : "Out of stock"}
                        </p>
                      </div>
                      {selectMode ? (
                        selected ? (
                          <FiCheck size={16} className="shrink-0 text-(--primary)" aria-label="Selected" />
                        ) : (
                          <FiPlus size={16} className="shrink-0 text-(--primary)" />
                        )
                      ) : single ? (
                        <FiPlus size={16} className="shrink-0 text-(--primary)" />
                      ) : (
                        <FiChevronDown
                          size={16}
                          className={`shrink-0 text-neutral-400 transition-transform ${expandedId === product.id ? "rotate-180" : ""}`}
                        />
                      )}
                    </button>

                    {!selectMode && expandedId === product.id && variations.length > 1 && (
                      <div className="grid gap-1.5 bg-neutral-50 px-3 py-2 sm:grid-cols-2">
                        {variations.map((variation) => {
                          const atLimit = quantityInOrder(variation.id) >= variation.stock_quantity;
                          return (
                            <button
                              key={variation.id}
                              type="button"
                              onClick={() => onAdd(toLine(product, variation))}
                              disabled={atLimit}
                              className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left text-sm hover:border-(--primary)/50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-neutral-800">{variationLabel(variation)}</span>
                                <span className="block truncate text-xs text-neutral-500">{variation.sku}</span>
                              </span>
                              <span className="shrink-0 text-right">
                                <span className="block font-semibold text-neutral-900">
                                  {formatBDT(variation.effective_price ?? variation.price)}
                                </span>
                                <span className={`block text-xs ${variation.stock_quantity > 0 ? "text-emerald-600" : "text-red-600"}`}>
                                  {variation.stock_quantity > 0 ? `${variation.stock_quantity} left` : "Out of stock"}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {!error && count > results.length && (
            <button
              type="button"
              onClick={() => setLimit(EXPANDED_RESULTS)}
              disabled={pending || limit >= EXPANDED_RESULTS}
              className="w-full border-t border-neutral-100 px-3 py-2 text-sm font-medium text-(--primary) hover:bg-(--primary)/5 disabled:text-neutral-400"
            >
              {limit >= EXPANDED_RESULTS
                ? `Showing ${results.length} of ${count} — refine your search`
                : `Show more (${count} results)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
