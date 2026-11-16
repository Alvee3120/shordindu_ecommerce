"use client";

import { useEffect, useMemo, useState } from "react";
import ProductShowcase from "@/components/homepage/ProductShowcase";
import {
  DISCOUNTS_CHANGED_EVENT,
  DISCOUNTS_CHANNEL,
  getDiscountShowcases,
} from "@/lib/discounts";
import { listProducts, toCardProduct, variationPricing } from "@/lib/products";

// Keep the rows in step with admin discount changes while the page stays open.
const POLL_INTERVAL_MS = 60_000;
// Both rows show four cards.
const ROW_SIZE = 4;
const DISCOUNTED_SIZE = 4;
// Over-fetch so there are still enough cards left after the current product and
// the discount row are excluded.
const FETCH_SIZE = 16;

/** Largest saving the given cards actually show, as a whole percent. */
function maxSavePercent(cards) {
  return cards.reduce((best, card) => {
    const price = Number(card.price);
    const original = Number(card.originalPrice);
    if (!Number.isFinite(price) || !Number.isFinite(original) || original <= price) {
      return best;
    }
    return Math.max(best, Math.round(100 - (price / original) * 100));
  }, 0);
}

/**
 * Recommendation rows for the product details page.
 *
 * "Related Discount Products" shows products a live automatic discount is
 * currently pricing — same-category products first (see `relevant` below), and
 * only when at least one genuinely discounted product is left. "You May Like"
 * shows same-category products in a single horizontal row; products already
 * shown in the discount row are held back so the two sections never repeat.
 *
 * Discount data comes from /discount-showcases/ (no-store), so create / edit /
 * expiry shows up without a hard refresh — same tab via a window event, other
 * tabs via BroadcastChannel, with polling as the safety net.
 */
export default function ProductRecommendations({ product }) {
  const productId = product?.id ?? null;
  const categoryKey = product?.categories?.join(",") || "";

  const [discountSections, setDiscountSections] = useState([]);
  const [related, setRelated] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let channel = null;

    const refresh = () => {
      getDiscountShowcases().then((data) => {
        if (!cancelled) setDiscountSections(data);
      });
    };

    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", refresh);
    window.addEventListener(DISCOUNTS_CHANGED_EVENT, refresh);
    document.addEventListener("visibilitychange", handleVisibility);
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(DISCOUNTS_CHANNEL);
      channel.onmessage = refresh;
    }

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(DISCOUNTS_CHANGED_EVENT, refresh);
      document.removeEventListener("visibilitychange", handleVisibility);
      channel?.close();
    };
  }, []);

  useEffect(() => {
    if (!categoryKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no category means no recommendations to show
      setRelated([]);
      setRelatedLoading(false);
      return;
    }
    let cancelled = false;
    setRelatedLoading(true);
    listProducts({ category: categoryKey, page_size: FETCH_SIZE, status: "active" })
      .then((data) => {
        if (cancelled) return;
        const results = Array.isArray(data) ? data : data?.results ?? [];
        setRelated(results);
      })
      .catch(() => {
        if (!cancelled) setRelated([]);
      })
      .finally(() => {
        if (!cancelled) setRelatedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [categoryKey]);

  const productCategories = useMemo(
    () => new Set((product?.categories || []).map(Number)),
    [product?.categories]
  );

  const discounted = useMemo(() => {
    if (!productId) return null;

    let section = null;
    const seen = new Set([Number(productId)]);
    const sameCategory = [];
    const others = [];

    discountSections.forEach((candidate) => {
      (candidate.products || []).forEach((entry) => {
        const id = Number(entry.id);
        if (seen.has(id)) return;
        if ((entry.status || "active") !== "active") return;

        const variations = entry.variations || [];
        if (!variations.some((variation) => Number(variation.stock_quantity) > 0)) return;

        // Only a real price cut belongs here. Basket offers (e.g. "Buy 2, get
        // 10% off") never change a unit price, so they would leave a card with
        // a discount badge and no crossed-out price.
        const priced = variations.some(
          (variation) => variationPricing(variation).originalPrice != null
        );
        if (!priced) return;

        seen.add(id);
        if (!section) section = candidate;

        const card = toCardProduct(entry);
        const isRelated = (entry.categories || []).some((categoryId) =>
          productCategories.has(Number(categoryId))
        );
        if (isRelated) sameCategory.push(card);
        else others.push(card);
      });
    });

    if (!section) return null;

    // Same-category products lead, so the row stays relevant to what's on screen.
    const all = [...sameCategory, ...others];
    const items = all.slice(0, DISCOUNTED_SIZE);
    if (items.length === 0) return null;

    // The heading quotes the biggest saving the row actually shows.
    return { section, items, savePercent: maxSavePercent(all) };
  }, [discountSections, productId, productCategories]);

  const discountIds = useMemo(
    () => new Set((discounted?.items || []).map((entry) => Number(entry.id))),
    [discounted]
  );

  const youMayLike = useMemo(
    () =>
      related
        .filter((entry) => Number(entry.id) !== Number(productId))
        .map(toCardProduct)
        .filter((card) => !discountIds.has(Number(card.id)))
        .slice(0, ROW_SIZE),
    [related, productId, discountIds]
  );

  if (!discounted && !relatedLoading && youMayLike.length === 0) return null;

  return (
    <div className="flex flex-col gap-14">
      {discounted && (
        <ProductShowcase
          flush
          title={
            discounted.savePercent > 0
              ? `Upto ${discounted.savePercent}% Off`
              : "Related Discount Products"
          }
          products={discounted.items}
          viewAllHref={`/shop?discount=${discounted.section.id}`}
        />
      )}

      <ProductShowcase
        flush
        title="You May Like"
        products={youMayLike}
        loading={relatedLoading}
      />
    </div>
  );
}
