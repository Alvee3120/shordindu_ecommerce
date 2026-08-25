"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiHeart } from "react-icons/fi";

/**
 * product: { id, name, description, image, price, href }
 */
export default function ProductCard({ product, tall = false }) {
  const [wishlisted, setWishlisted] = useState(false);
  const { name, description, image, price, href = "#" } = product;

  return (
    <div className="group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm transition-shadow hover:shadow-lg sm:rounded-3xl">
      <Link
        href={href}
        className={`relative block w-full overflow-hidden bg-gradient-to-br from-rose-100 via-violet-100 to-amber-100 ${
          tall ? "h-full min-h-[280px] flex-1" : "aspect-[4/5]"
        }`}
      >
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-neutral-400 sm:text-sm">
            No image
          </div>
        )}
      </Link>

      <button
        type="button"
        onClick={() => setWishlisted((w) => !w)}
        aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-neutral-500 backdrop-blur-md transition-colors hover:text-red-500 sm:top-3 sm:right-3 sm:h-9 sm:w-9"
      >
        <FiHeart
          className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${wishlisted ? "text-red-500" : ""}`}
          fill={wishlisted ? "currentColor" : "none"}
        />
      </button>

      <div className="flex flex-1 flex-col gap-1 p-2.5 sm:gap-1.5 sm:p-4">
        <Link href={href}>
          <h3 className=" line-clamp-1 text-sm font-semibold text-neutral-900 sm:text-base">
            {name}
          </h3>
        </Link>

        {description && (
          <p className="line-clamp-2 text-[10px]  sm:text-sm text-neutral-500">{description}</p>
        )}

        <div className="mt-1 flex items-center justify-between gap-1 sm:mt-2 sm:gap-2">
          <span className="text-[10px] font-bold text-neutral-900 sm:text-lg">
            {price != null ? `৳ ${price}` : "—"}
          </span>
          <Link
            href={href}
            className="rounded-full bg-neutral-900 px-2 py-1 text-[10px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-(--primary) sm:px-4 sm:py-2 sm:text-xs"
          >
            View Options
          </Link>
        </div>
      </div>
    </div>
  );
}
