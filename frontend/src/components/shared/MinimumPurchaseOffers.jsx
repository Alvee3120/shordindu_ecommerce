"use client";

import { FiTag } from "react-icons/fi";
import { formatBDT } from "@/lib/format";
import { minimumPurchaseMessage } from "@/lib/discounts";

/**
 * "Spend over ৳2,000 and get 10% OFF", "Add ৳500 more to unlock 10% OFF!" or
 * "Congratulations! You unlocked 10% OFF." — driven by the cart API's
 * `minimum_purchase_offers` (live progress) or a product's
 * `minimum_purchase_offers` (configuration only, before it's in the cart).
 * Re-renders whenever the cart subtotal changes, so no reload is needed.
 */
export default function MinimumPurchaseOffers({ offers = [], className = "" }) {
  const list = (offers || []).filter(Boolean);
  if (list.length === 0) return null;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {list.map((offer) => {
        const minimum = Number(offer.min_purchase_amount) || 0;
        const eligible = Number(offer.eligible_subtotal);
        const hasProgress = Number.isFinite(eligible) && minimum > 0;
        const progress = hasProgress ? Math.min(100, Math.round((eligible / minimum) * 100)) : null;
        const qualified = Boolean(offer.qualified);

        return (
          <div
            key={offer.id}
            className={`rounded-lg border px-3 py-2 text-sm ${
              qualified
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-(--primary)/25 bg-(--primary)/10 text-(--primary)"
            }`}
          >
            <p className="flex items-start gap-1.5 font-medium">
              <FiTag size={14} className="mt-0.5 shrink-0" />
              {minimumPurchaseMessage(offer)}
            </p>
            {progress != null && !qualified && (
              <div className="mt-1.5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/70">
                  <div className="h-full rounded-full bg-(--primary) transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-1 text-xs opacity-80">
                  {formatBDT(eligible)} of {formatBDT(minimum)}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
