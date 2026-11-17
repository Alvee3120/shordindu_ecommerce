"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { useCart } from "@/context/CartContext";
import { addCartItem } from "@/lib/cart";
import { isLightColor } from "@/lib/products";

const MAX_SWATCHES = 4;

function ColorSwatches({ colors, selected, onSelect }) {
  if (!colors.length) return null;
  const visible = colors.slice(0, MAX_SWATCHES);
  const extra = colors.length - visible.length;
  return (
    <div className="flex shrink-0 items-center gap-1" aria-label="Available colors">
      {visible.map((color) => {
        const isSelected = Number(selected) === Number(color.attribute_value);
        return (
          <button
            key={color.attribute_value}
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSelect(color.attribute_value);
            }}
            aria-label={color.name}
            aria-pressed={isSelected}
            title={color.name}
            className={`h-3.5 w-3.5 shrink-0 rounded-full border transition-transform hover:scale-110 sm:h-4 sm:w-4 ${
              isSelected
                ? "scale-110 border-transparent"
                : isLightColor(color.hex_code)
                  ? "border-neutral-300"
                  : "border-black/10"
            }`}
            style={{ backgroundColor: color.hex_code }}
          />
        );
      })}
      {extra > 0 && (
        <span className="text-[10px] font-medium text-neutral-400">+{extra}</span>
      )}
    </div>
  );
}

export default function ProductCard({ product }) {
  const [selectedColorId, setSelectedColorId] = useState(
    () => product.colors?.[0]?.attribute_value ?? null
  );
  const [adding, setAdding] = useState(false);
  const { refreshCart } = useCart();

  const {
    name,
    image,
    price,
    originalPrice,
    discountLabel,
    colors = [],
    quickAdd = false,
    variationId,
    inStock,
    href = "#",
  } = product;

  const selectedColor =
    colors.find((color) => Number(color.attribute_value) === Number(selectedColorId)) ||
    colors[0] ||
    null;
  const displayImage = selectedColor?.image || image;
  const displayPrice = selectedColor?.price ?? price;
  const displayOriginal = selectedColor?.originalPrice ?? originalPrice;
  const displayDiscount = selectedColor?.discountLabel ?? discountLabel;
  const canAdd = selectedColor ? selectedColor.inStock !== false : inStock !== false;
  const addVariationId = selectedColor?.variationId ?? variationId;
  const detailHref = selectedColor
    ? `${href}?color=${selectedColor.attribute_value}`
    : href;

  const handleAddToCart = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (adding) return;
    if (!canAdd) {
      toast.error("This item is out of stock.");
      return;
    }
    if (!addVariationId) {
      toast.error("This option is unavailable.");
      return;
    }
    setAdding(true);
    try {
      await addCartItem({ product: product.id, variation: addVariationId, quantity: 1 });
      await refreshCart();
      toast.success("Added to cart.");
    } catch (err) {
      toast.error(err.message || "Could not add item to cart.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="group relative flex h-full w-full min-w-0 flex-col">
      <div className="relative w-full overflow-hidden bg-neutral-100">
        <Link href={detailHref} className="relative block aspect-[4/5] w-full">
          {displayImage ? (
            <Image
              src={displayImage}
              alt={name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-neutral-400 sm:text-sm">
              No image
            </div>
          )}
        </Link>

        {displayDiscount && (
          <span className="absolute top-2 left-2 z-10 bg-red-600 px-2 py-1 text-[9px] font-bold tracking-wide text-white uppercase sm:top-3 sm:left-3 sm:px-2.5 sm:text-[10px]">
            {displayDiscount}
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 z-10 translate-y-0 opacity-100 transition-all duration-300 lg:translate-y-3 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100 lg:group-focus-within:translate-y-0 lg:group-focus-within:opacity-100">
          {quickAdd ? (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={adding || !canAdd}
              className="block w-full bg-black px-3 py-3.5 text-center text-[11px] font-semibold tracking-[0.12em] text-white uppercase transition-colors hover:bg-(--primary) disabled:cursor-not-allowed disabled:bg-neutral-700 sm:text-xs"
            >
              {adding ? "Adding..." : canAdd ? "Add to Cart" : "Out of Stock"}
            </button>
          ) : (
            <Link
              href={detailHref}
              className="block w-full bg-black px-3 py-3.5 text-center text-[11px] font-semibold tracking-[0.12em] text-white uppercase transition-colors hover:bg-(--primary) sm:text-xs"
            >
              View Details
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 pt-2.5">
        <div className="flex items-center justify-between gap-2">
          <Link href={detailHref} className="min-w-0 flex-1">
            <h3 className="truncate text-[11px] font-semibold tracking-wide text-neutral-900 uppercase sm:text-sm">
              {name}
            </h3>
          </Link>
          <ColorSwatches
            colors={colors}
            selected={selectedColor?.attribute_value}
            onSelect={setSelectedColorId}
          />
        </div>

        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span
            className={`text-sm font-bold whitespace-nowrap sm:text-base ${
              displayOriginal != null ? "text-red-600" : "text-neutral-900"
            }`}
          >
            {displayPrice != null ? `৳ ${displayPrice}` : "—"}
          </span>
          {displayOriginal != null && (
            <span className="text-[11px] whitespace-nowrap text-neutral-400 line-through sm:text-xs">
              ৳ {displayOriginal}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
