"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { FiChevronLeft, FiChevronRight, FiMinus, FiPlus, FiTruck, FiShield, FiMaximize2, FiX } from "react-icons/fi";
import { getProduct, getProductAddons, listProducts, toCardProduct } from "@/lib/products";
import { addCartItem, addCartItemAddon, getCart, updateCartItem, deleteCartItem } from "@/lib/cart";
import { useCart } from "@/context/CartContext";
import ProductCard from "@/components/ProductCard";
import ProductReviews from "@/components/ProductReviews";
import ImageZoom from "@/components/ImageZoom";

export default function ProductDetailsPage() {
  const { id } = useParams();
  const { refreshCart } = useCart();
  const [product, setProduct] = useState(null);
  const [addons, setAddons] = useState([]);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeImage, setActiveImage] = useState(0);
  const [selectedValues, setSelectedValues] = useState({}); 
  const [wishlisted, setWishlisted] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedAddonIds, setSelectedAddonIds] = useState(new Set());
  const [addonSelectedValues, setAddonSelectedValues] = useState({}); // { [addonLinkId]: { [attribute]: attribute_value_id } }
  const [addonQuantities, setAddonQuantities] = useState({}); // { [addonLinkId]: quantity }
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [drawerCart, setDrawerCart] = useState(null);
  const [drawerUpdatingId, setDrawerUpdatingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([getProduct(id), getProductAddons(id).catch(() => [])])
      .then(([productData, addonData]) => {
        if (cancelled) return;
        setProduct(productData);
        setAddons(addonData || []);
        setActiveImage(0);
        setQuantity(1);
        setSelectedAddonIds(new Set());
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const categoryFilterKey = product?.categories?.join(",") || "";

  useEffect(() => {
    if (!categoryFilterKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale related products when there's no category
      setRelatedProducts([]);
      return;
    }
    let cancelled = false;
    listProducts({ category: categoryFilterKey, page_size: 8 })
      .then((data) => {
        if (cancelled) return;
        const results = Array.isArray(data) ? data : data?.results ?? [];
        setRelatedProducts(
          results.filter((p) => p.id !== product.id).slice(0, 4).map(toCardProduct)
        );
      })
      .catch(() => {
        if (!cancelled) setRelatedProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [categoryFilterKey, product?.id]);

  useEffect(() => {
    const imageCount = product?.images?.length || 0;
    if (imageCount <= 1) return;
    const timer = setInterval(() => {
      setActiveImage((prev) => (prev + 1) % imageCount);
    }, 5000);
    return () => clearInterval(timer);
  }, [product]);

  // group the product's attribute values by attribute name, e.g. { Size: [S, M], Color: [Red] }
  const attributeGroups = useMemo(() => {
    if (!product) return [];
    const groups = new Map();
    (product.variations || []).forEach((v) => {
      (v.attribute_values || []).forEach((av) => {
        if (!groups.has(av.attribute)) groups.set(av.attribute, new Map());
        groups.get(av.attribute).set(av.attribute_value, av.value);
      });
    });
    return Array.from(groups.entries()).map(([attribute, values]) => ({
      attribute,
      values: Array.from(values.entries()).map(([id, value]) => ({ id, value })),
    }));
  }, [product]);

  const selectedVariation = useMemo(() => {
    if (!product) return null;
    const variations = product.variations || [];
    if (variations.length <= 1) return variations[0] || null;

    const selectedIds = Object.values(selectedValues);
    if (selectedIds.length < attributeGroups.length) return null;

    return (
      variations.find((v) => {
        const vIds = (v.attribute_values || []).map((av) => av.attribute_value);
        return selectedIds.every((id) => vIds.includes(id));
      }) || null
    );
  }, [product, selectedValues, attributeGroups]);

  if (loading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-16 text-sm text-neutral-500">
        Loading product...
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-16 pt-20 text-center">
        <p className="text-sm text-neutral-500">{error || "Product not found."}</p>
        <Link href="/" className="mt-4 inline-block text-sm font-semibold text-(--primary) hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  const images = product.images?.length ? product.images : [];
  const variations = product.variations || [];
  const isVariable = product.product_type === "variable" && variations.length >= 1;
  const displayPrice = selectedVariation?.price ?? variations[0]?.price;
  const displayCompareAt = selectedVariation?.compare_at_price ?? variations[0]?.compare_at_price;
  const displayStock = selectedVariation?.stock_quantity ?? variations[0]?.stock_quantity ?? 0;
  const inStock = isVariable ? (selectedVariation ? displayStock > 0 : null) : displayStock > 0;
  const discountPct =
    displayCompareAt && displayPrice && displayCompareAt > displayPrice
      ? Math.round(100 - (displayPrice / displayCompareAt) * 100)
      : null;
  const maxQuantity = displayStock > 0 ? displayStock : 1;

  if (quantity > maxQuantity) {
    setQuantity(maxQuantity);
  }

  const toggleAddon = (addonLink) => {
    setSelectedAddonIds((prev) => {
      const next = new Set(prev);
      if (next.has(addonLink.id)) next.delete(addonLink.id);
      else next.add(addonLink.id);
      return next;
    });
    setAddonQuantities((prev) => ({ ...prev, [addonLink.id]: prev[addonLink.id] ?? 1 }));
  };

  const getAddonQuantity = (addonLink) => addonQuantities[addonLink.id] ?? 1;

  const setAddonQuantity = (addonLink, qty) => {
    const variation = getAddonVariation(addonLink);
    const max = variation?.stock_quantity > 0 ? variation.stock_quantity : 99;
    setAddonQuantities((prev) => ({ ...prev, [addonLink.id]: Math.min(Math.max(1, qty), max) }));
  };

  const getAddonVariations = (addonLink) => addonLink.addon_product_detail?.variations || [];

  // group an addon's own variations by attribute name, same shape as attributeGroups above
  const getAddonAttributeGroups = (addonLink) => {
    const groups = new Map();
    getAddonVariations(addonLink).forEach((v) => {
      (v.attribute_values || []).forEach((av) => {
        if (!groups.has(av.attribute)) groups.set(av.attribute, new Map());
        groups.get(av.attribute).set(av.attribute_value, av.value);
      });
    });
    return Array.from(groups.entries()).map(([attribute, values]) => ({
      attribute,
      values: Array.from(values.entries()).map(([id, value]) => ({ id, value })),
    }));
  };

  const getAddonVariation = (addonLink) => {
    const addonVariations = getAddonVariations(addonLink);
    if (addonVariations.length <= 1) return addonVariations[0] || null;

    const groups = getAddonAttributeGroups(addonLink);
    const selected = addonSelectedValues[addonLink.id] || {};
    const selectedIds = Object.values(selected);
    if (selectedIds.length < groups.length) return null;

    return (
      addonVariations.find((v) => {
        const vIds = (v.attribute_values || []).map((av) => av.attribute_value);
        return selectedIds.every((id) => vIds.includes(id));
      }) || null
    );
  };

  const toggleAddonValue = (addonLink, attribute, valueId) => {
    setAddonSelectedValues((prev) => ({
      ...prev,
      [addonLink.id]: { ...prev[addonLink.id], [attribute]: valueId },
    }));
  };

  const addonUnitPrice = (addonLink) =>
    addonLink.price_override ?? getAddonVariation(addonLink)?.price ?? getAddonVariations(addonLink)[0]?.price ?? 0;

  const addonsTotal = addons
    .filter((a) => selectedAddonIds.has(a.id))
    .reduce((sum, a) => sum + Number(addonUnitPrice(a)) * getAddonQuantity(a), 0);

  const totalPrice = displayPrice != null ? displayPrice * quantity + addonsTotal : null;

  const handleAddToCart = async () => {
    if (!selectedVariation && isVariable) {
      toast.error("Please select a size before adding to cart.");
      return;
    }
    if (!inStock) {
      toast.error("This item is out of stock.");
      return;
    }
    const variation = selectedVariation || variations[0];
    if (!variation) {
      toast.error("This product has no purchasable variation.");
      return;
    }
    if (quantity > variation.stock_quantity) {
      toast.error(`Only ${variation.stock_quantity} left in stock.`);
      return;
    }

    const selectedAddons = addons.filter((a) => selectedAddonIds.has(a.id));
    for (const addonLink of selectedAddons) {
      if (getAddonVariations(addonLink).length > 1 && !getAddonVariation(addonLink)) {
        toast.error(`Please select options for ${addonLink.addon_product_detail?.name}.`);
        return;
      }
    }

    setAddingToCart(true);
    try {
      const cartItem = await addCartItem({
        product: product.id,
        variation: variation.id,
        quantity,
      });

      for (const addonLink of selectedAddons) {
        const addonVariation = getAddonVariation(addonLink) || getAddonVariations(addonLink)[0];
        if (!addonVariation) continue;
        await addCartItemAddon(cartItem.id, {
          product: addonLink.addon_product,
          variation: addonVariation.id,
          quantity: getAddonQuantity(addonLink),
        });
      }

      await loadDrawerCart();
      setCartDrawerOpen(true);
    } catch (err) {
      toast.error(err.message || "Could not add item to cart.");
    } finally {
      setAddingToCart(false);
    }
  };

  const loadDrawerCart = async () => {
    try {
      const data = await getCart();
      setDrawerCart(data);
      refreshCart();
    } catch {
      // silently ignore — the drawer just won't have anything to show
    }
  };

  const handleDrawerQuantityChange = async (item, nextQuantity) => {
    if (nextQuantity < 1) return;
    setDrawerUpdatingId(item.id);
    try {
      await updateCartItem(item.id, { quantity: nextQuantity });
      await loadDrawerCart();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDrawerUpdatingId(null);
    }
  };

  const handleDrawerRemoveItem = async (item) => {
    setDrawerUpdatingId(item.id);
    try {
      await deleteCartItem(item.id);
      await loadDrawerCart();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDrawerUpdatingId(null);
    }
  };

  const scrollThumbs = (dir) => {
    setActiveImage((prev) => {
      const next = prev + dir;
      if (next < 0) return images.length - 1;
      if (next >= images.length) return 0;
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-6 pt-20 pb-10 sm:px-8">
      <Link
        href="/"
        className="mb-6 flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-(--primary)"
      >
        <FiChevronLeft size={16} />
        Back
      </Link>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Gallery */}
        <div className="flex flex-col gap-3">
          <div className="group relative h-120 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-rose-100 via-violet-100 to-amber-100">
            {images[activeImage] ? (
              <ImageZoom
                src={images[activeImage].image}
                alt={images[activeImage].alt_text || product.name}
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-neutral-400">
                No image
              </div>
            )}

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => scrollThumbs(-1)}
                  aria-label="Previous image"
                  className="absolute top-1/2 left-3 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-neutral-700 opacity-0 shadow-md backdrop-blur transition-opacity group-hover:opacity-100 hover:bg-white"
                >
                  <FiChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => scrollThumbs(1)}
                  aria-label="Next image"
                  className="absolute top-1/2 right-3 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-neutral-700 opacity-0 shadow-md backdrop-blur transition-opacity group-hover:opacity-100 hover:bg-white"
                >
                  <FiChevronRight size={18} />
                </button>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto py-0.5">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveImage(idx)}
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${
                    idx === activeImage ? "border-(--primary)" : "border-transparent"
                  }`}
                >
                  <Image src={img.image} alt="" fill className="object-cover" sizes="64px" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold tracking-widest text-neutral-400 uppercase">
            {(product.category_names || []).join(", ")}
          </p>
          <h1 className="font-sora text-3xl leading-tight font-semibold text-neutral-900">
            {product.name}
          </h1>



          <div className="mt-1 flex items-center gap-3">
            <span className="text-2xl font-bold text-neutral-900">
              {displayPrice != null ? `৳${displayPrice}` : "—"}
            </span>
            {displayCompareAt && (
              <span className="text-base text-neutral-400 line-through">৳{displayCompareAt}</span>
            )}
            {discountPct != null && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                {discountPct}% off
              </span>
            )}
          </div>

          {product.description && (
            <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-neutral-600">
              {product.description}
            </p>
          )}
          
          {isVariable && attributeGroups.length > 0 && (
            <div className="mt-2 flex flex-col gap-3">
              {attributeGroups.map((group) => (
                <div key={group.attribute}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-sm font-medium text-neutral-700">{group.attribute}:</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.values.map((v) => {
                      const checked = selectedValues[group.attribute] === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() =>
                            setSelectedValues((prev) => ({ ...prev, [group.attribute]: v.id }))
                          }
                          className={`rounded-full border px-5 py-2 text-sm font-medium transition-colors ${
                            checked
                              ? "border-(--primary) bg-(--primary)/15 text-(--primary)"
                              : "border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-neutral-300"
                          }`}
                        >
                          {v.value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-sm font-medium">
            {inStock === null ? (
              <span className="text-neutral-400">Select options to see availability</span>
            ) : inStock ? (
              <span className="text-emerald-600">In stock ({displayStock} available)</span>
            ) : (
              <span className="text-red-600">Out of stock</span>
            )}
          </p>

          {addons.length > 0 && (
            <div className="mt-2">
              <p className="mb-1.5 text-sm font-medium text-neutral-700">Add-ons:</p>
              <div className="flex flex-col gap-2">
                {addons.map((addonLink) => {
                  const checked = selectedAddonIds.has(addonLink.id);
                  const price = addonUnitPrice(addonLink);
                  const addonGroups = getAddonAttributeGroups(addonLink);
                  const addonSelected = addonSelectedValues[addonLink.id] || {};
                  const addonHasVariants = getAddonVariations(addonLink).length > 1;
                  const showAddonOptions = checked && addonHasVariants;
                  const addonQty = getAddonQuantity(addonLink);
                  return (
                    <div
                      key={addonLink.id}
                      className={`rounded-xl border px-4 py-2.5 text-sm transition-colors ${
                        checked
                          ? "border-(--primary) bg-(--primary)/10"
                          : "border-neutral-200 hover:border-neutral-300"
                      }`}
                    >
                      <label className="flex cursor-pointer items-center justify-between">
                        <span className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAddon(addonLink)}
                            className="h-4 w-4 accent-(--primary)"
                          />
                          <span className="font-medium text-neutral-800">
                            {addonLink.addon_product_detail?.name}
                          </span>
                        </span>
                        <span className="text-neutral-500">+৳{(price * addonQty).toFixed(2)}</span>
                      </label>

                      {checked && (
                        <div className="mt-2 flex flex-col gap-2 pl-6.5">
                          {addonGroups.map((group) => (
                            <div key={group.attribute} className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-medium text-neutral-500">
                                {group.attribute}:
                              </span>
                              {group.values.map((v) => {
                                const valueChecked = addonSelected[group.attribute] === v.id;
                                return (
                                  <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => toggleAddonValue(addonLink, group.attribute, v.id)}
                                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                      valueChecked
                                        ? "border-(--primary) bg-(--primary)/15 text-(--primary)"
                                        : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
                                    }`}
                                  >
                                    {v.value}
                                  </button>
                                );
                              })}
                            </div>
                          ))}

                          {showAddonOptions && !getAddonVariation(addonLink) && (
                            <p className="text-xs text-red-600">Please select an option above.</p>
                          )}

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-neutral-500">Qty:</span>
                            <div className="flex items-center rounded-full border border-neutral-200">
                              <button
                                type="button"
                                onClick={() => setAddonQuantity(addonLink, addonQty - 1)}
                                disabled={addonQty <= 1}
                                aria-label="Decrease add-on quantity"
                                className="flex h-7 w-7 items-center justify-center text-neutral-500 hover:text-(--primary) disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <FiMinus size={11} />
                              </button>
                              <span className="w-6 text-center text-xs font-semibold">{addonQty}</span>
                              <button
                                type="button"
                                onClick={() => setAddonQuantity(addonLink, addonQty + 1)}
                                aria-label="Increase add-on quantity"
                                className="flex h-7 w-7 items-center justify-center text-neutral-500 hover:text-(--primary) disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <FiPlus size={11} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-2 flex items-center gap-3">
            <div className="flex items-center rounded-full border border-neutral-200">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
                className="flex h-11 w-10 items-center justify-center text-neutral-500 hover:text-(--primary) disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FiMinus size={14} />
              </button>
              <span className="w-8 text-center text-sm font-semibold">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                disabled={quantity >= maxQuantity}
                aria-label="Increase quantity"
                className="flex h-11 w-10 items-center justify-center text-neutral-500 hover:text-(--primary) disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FiPlus size={14} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={inStock === false || addingToCart}
              aria-disabled={inStock === null || undefined}
              className={`h-11 flex-1 rounded-full bg-neutral-900 px-6 text-sm font-semibold tracking-wide text-white uppercase transition-colors hover:bg-(--primary) disabled:cursor-not-allowed disabled:opacity-50 ${
                inStock === null ? "cursor-not-allowed opacity-50" : ""
              }`}
            >
              {addingToCart
                ? "Adding..."
                : totalPrice != null
                  ? `Add to cart — ৳${totalPrice.toFixed(2)}`
                  : "Add to cart"}
            </button>

          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-neutral-100 pt-5">
            <Link
              href="/footerLinks/order-delivery"
              className="flex flex-col items-center gap-1.5 text-center text-neutral-500 hover:text-(--primary)"
            >
              <FiTruck size={20} />
              <span className="text-xs">Shipping & Delivery</span>
            </Link>
            <Link
              href="/footerLinks/wash-care"
              className="flex flex-col items-center gap-1.5 text-center text-neutral-500 hover:text-(--primary)"
            >
              <FiShield size={20} />
              <span className="text-xs">Wash & Care</span>
            </Link>
            <Link
              href="/footerLinks/size-guide"
              className="flex flex-col items-center gap-1.5 text-center text-neutral-500 hover:text-(--primary)"
            >
              <FiMaximize2 size={20} />
              <span className="text-xs">Size guide</span>
            </Link>
          </div>
        </div>
      </div>

      {product && <ProductReviews productId={product.id} />}

      {relatedProducts.length > 0 && (
        <div className="mt-16 border-t border-neutral-100 pt-10">
          <h2 className="font-sora mb-6 text-2xl font-bold text-neutral-900">You may also like</h2>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} />
            ))}
          </div>
        </div>
      )}

      {cartDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close cart"
            onClick={() => setCartDrawerOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
              <h2 className="font-sora text-lg font-bold tracking-wide text-neutral-900 uppercase">
                Shopping Cart
              </h2>
              <button
                type="button"
                onClick={() => setCartDrawerOpen(false)}
                className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-(--primary)"
              >
                <FiX size={16} />
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {!drawerCart?.items?.length ? (
                <p className="text-sm text-neutral-500">Your cart is empty.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {drawerCart.items.map((item) => (
                    <div key={item.id} className="flex gap-3 border-b border-neutral-100 pb-4">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                        {item.product_image ? (
                          <Image src={item.product_image} alt="" fill className="object-cover" sizes="64px" />
                        ) : null}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-neutral-900">{item.product_name}</p>
                          <button
                            type="button"
                            onClick={() => handleDrawerRemoveItem(item)}
                            disabled={drawerUpdatingId === item.id}
                            aria-label="Remove item"
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          >
                            <FiX size={14} />
                          </button>
                        </div>
                        {item.children?.map((addon) => (
                          <p key={addon.id} className="text-xs text-neutral-500">
                            {addon.product_name}
                            {addon.variation_label ? `: ${addon.variation_label}` : ""}{" "}
                            <span className="font-medium">৳{Number(addon.unit_price_snapshot).toFixed(2)}</span>
                          </p>
                        ))}
                        <div className="mt-2 flex items-center gap-3">
                          <div className="flex items-center rounded-full border border-neutral-200">
                            <button
                              type="button"
                              onClick={() => handleDrawerQuantityChange(item, item.quantity - 1)}
                              disabled={item.quantity <= 1 || drawerUpdatingId === item.id}
                              aria-label="Decrease quantity"
                              className="flex h-7 w-7 items-center justify-center text-neutral-500 hover:text-(--primary) disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <FiMinus size={11} />
                            </button>
                            <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => handleDrawerQuantityChange(item, item.quantity + 1)}
                              disabled={drawerUpdatingId === item.id}
                              aria-label="Increase quantity"
                              className="flex h-7 w-7 items-center justify-center text-neutral-500 hover:text-(--primary) disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <FiPlus size={11} />
                            </button>
                          </div>
                        </div>
                        <p className="mt-1.5 text-sm text-neutral-600">
                          {item.quantity} x ৳{Number(item.unit_price_snapshot).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {drawerCart?.items?.length > 0 && (
              <div className="border-t border-neutral-200 px-5 py-4">
                <div className="mb-4 flex items-center justify-between font-sora text-base font-bold text-neutral-900">
                  <span className="uppercase">Subtotal:</span>
                  <span>৳{Number(drawerCart.subtotal).toFixed(2)}</span>
                </div>
                <Link
                  href="/cart"
                  className="flex h-11 w-full items-center justify-center rounded-lg bg-neutral-100 text-sm font-semibold tracking-wide text-neutral-800 uppercase hover:bg-neutral-200"
                >
                  View Cart
                </Link>
                <Link
                  href="/checkout"
                  className="mt-2 flex h-11 w-full items-center justify-center rounded-lg bg-(--primary) text-sm font-semibold tracking-wide text-white uppercase hover:bg-(--primary)/90"
                >
                  Checkout
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
