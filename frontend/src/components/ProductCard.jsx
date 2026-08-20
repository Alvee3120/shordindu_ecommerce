"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiHeart } from "react-icons/fi";

/**
 * product: { id, name, description, image, price, href }
 */
export default function ProductCard({ product }) {
  const [wishlisted, setWishlisted] = useState(false);
  const { name, description, image, price, href = "#" } = product;

  return (
    <div className="group relative flex w-full flex-col overflow-hidden rounded-3xl border border-neutral-100 bg-white shadow-sm transition-shadow hover:shadow-lg">
      <Link
        href={href}
        className="relative block aspect-[4/5] w-full overflow-hidden bg-gradient-to-br from-rose-100 via-violet-100 to-amber-100"
      >
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 280px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-400">
            No image
          </div>
        )}
      </Link>

      <button
        type="button"
        onClick={() => setWishlisted((w) => !w)}
        aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-neutral-500 backdrop-blur-md transition-colors hover:text-red-500"
      >
        <FiHeart
          size={16}
          fill={wishlisted ? "currentColor" : "none"}
          className={wishlisted ? "text-red-500" : ""}
        />
      </button>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <Link href={href}>
          <h3 className="font-sora line-clamp-1 font-semibold text-neutral-900">{name}</h3>
        </Link>
        {description && (
          <p className="line-clamp-2 text-sm text-neutral-500">{description}</p>
        )}

        <div className="mt-2 flex items-center justify-between">
          <span className="text-lg font-bold text-neutral-900">৳ {price}</span>
          <Link
            href={href}
            className="rounded-full bg-neutral-900 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-(--primary)"
          >
            Buy
          </Link>
        </div>
      </div>
    </div>
  );
}
