"use client";

import { useMemo, useState } from "react";
import { FiChevronDown } from "react-icons/fi";
import { buildCategoryTree } from "@/lib/categories";

const PRICE_BOUNDS = { min: 0, max: 5000, step: 50 };

const rangeThumbClass =
  "pointer-events-none absolute inset-x-0 top-1/2 h-1.5 w-full -translate-y-1/2 appearance-none bg-transparent " +
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 " +
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 " +
  "[&::-webkit-slider-thumb]:border-(--primary) [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow " +
  "[&::-webkit-slider-thumb]:cursor-pointer " +
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 " +
  "[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 " +
  "[&::-moz-range-thumb]:border-(--primary) [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow " +
  "[&::-moz-range-thumb]:cursor-pointer [&::-moz-range-track]:bg-transparent";

function PriceRangeSlider({ minPrice, maxPrice, onPriceChange }) {
  const { min: boundMin, max: boundMax, step } = PRICE_BOUNDS;
  const minVal = minPrice === "" ? boundMin : Number(minPrice);
  const maxVal = maxPrice === "" ? boundMax : Number(maxPrice);

  const minPercent = ((minVal - boundMin) / (boundMax - boundMin)) * 100;
  const maxPercent = ((maxVal - boundMin) / (boundMax - boundMin)) * 100;

  const handleMinChange = (e) => {
    const value = Math.min(Number(e.target.value), maxVal - step);
    onPriceChange("minPrice", value <= boundMin ? "" : String(value));
  };

  const handleMaxChange = (e) => {
    const value = Math.max(Number(e.target.value), minVal + step);
    onPriceChange("maxPrice", value >= boundMax ? "" : String(value));
  };

  return (
    <div>
      <div className="relative h-1.5 rounded-full bg-neutral-200">
        <div
          className="absolute h-1.5 rounded-full bg-(--primary)"
          style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }}
        />
        <input
          type="range"
          min={boundMin}
          max={boundMax}
          step={step}
          value={minVal}
          onChange={handleMinChange}
          aria-label="Minimum price"
          className={rangeThumbClass}
        />
        <input
          type="range"
          min={boundMin}
          max={boundMax}
          step={step}
          value={maxVal}
          onChange={handleMaxChange}
          aria-label="Maximum price"
          className={rangeThumbClass}
        />
      </div>
      <p className="mt-4 text-center text-sm font-medium text-neutral-700">
        ৳{minVal} – ৳{maxVal}
        {maxVal >= boundMax && "+"}
      </p>
    </div>
  );
}

/**
 * Pure presentational filter panel. Shared by the desktop sticky sidebar
 * and the mobile drawer — parent owns the draft filter state.
 *
 * filters: { parentCategory: string, childCategories: string[], minPrice: string, maxPrice: string }
 */
export default function FilterSidebar({
  categoryList = [],
  filters,
  onSelectParent,
  onToggleChild,
  onPriceChange,
  onApply,
  onClear,
  showApplyButton = false,
}) {
  const tree = useMemo(() => buildCategoryTree(categoryList), [categoryList]);
  const [expanded, setExpanded] = useState(() => new Set());

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="font-sora mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-900">
          Categories
        </h3>
        <ul className="flex flex-col gap-1">
          {tree.map((parent) => {
            const hasChildren = parent.children.length > 0;
            const isParentActive = filters.parentCategory === String(parent.id);
            const isOpen = expanded.has(parent.id) || isParentActive;

            return (
              <li key={parent.id}>
                <div className="flex items-center gap-1">
                  <label className="flex flex-1 cursor-pointer items-center gap-2 py-1 text-sm text-neutral-600 hover:text-neutral-900">
                    <input
                      type="checkbox"
                      checked={isParentActive}
                      onChange={() => onSelectParent(parent.id)}
                      className="h-4 w-4 rounded border-neutral-300 text-(--primary) focus:ring-(--primary)"
                    />
                    {parent.name}
                  </label>
                  {hasChildren && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(parent.id)}
                      aria-label={isOpen ? `Collapse ${parent.name}` : `Expand ${parent.name}`}
                      aria-expanded={isOpen}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-neutral-400 transition-colors hover:text-neutral-700"
                    >
                      <FiChevronDown
                        size={14}
                        className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  )}
                </div>

                {hasChildren && (
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      isOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <ul className="ml-2 flex flex-col gap-1.5 border-l border-neutral-100 py-1 pl-4">
                      {parent.children.map((child) => (
                        <li key={child.id}>
                          <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900">
                            <input
                              type="checkbox"
                              checked={filters.childCategories.includes(String(child.id))}
                              onChange={() => onToggleChild(child.id)}
                              className="h-3.5 w-3.5 rounded border-neutral-300 text-(--primary) focus:ring-(--primary)"
                            />
                            {child.name}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
          {tree.length === 0 && <li className="text-sm text-neutral-400">No categories available</li>}
        </ul>
      </div>

      <div>
        <h3 className="font-sora mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-900">
          Price Range
        </h3>
        <PriceRangeSlider
          minPrice={filters.minPrice}
          maxPrice={filters.maxPrice}
          onPriceChange={onPriceChange}
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        {showApplyButton && (
          <button
            type="button"
            onClick={onApply}
            className="flex-1 rounded-full bg-(--primary) px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90"
          >
            Apply Filters
          </button>
        )}
        <button
          type="button"
          onClick={onClear}
          className={`rounded-full border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 ${
            showApplyButton ? "" : "flex-1"
          }`}
        >
          Clear All
        </button>
      </div>
    </div>
  );
}
