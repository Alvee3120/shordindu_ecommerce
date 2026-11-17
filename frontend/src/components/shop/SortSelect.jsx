"use client";

import { FiChevronDown } from "react-icons/fi";

export const SORT_OPTIONS = [
  { value: "", label: "Newest" },
  { value: "name", label: "A to Z" },
  { value: "-name", label: "Z to A" },
  { value: "price", label: "Price: Low to High" },
  { value: "-price", label: "Price: High to Low" },
];

export default function SortSelect({ value, onChange }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
      <label
        htmlFor="shop-sort"
        className="sr-only text-sm font-medium text-neutral-500 sm:not-sr-only"
      >
        Sort By
      </label>
      <div className="relative min-w-0 flex-1 sm:flex-none">
        <select
          id="shop-sort"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-full border border-neutral-200 bg-background py-2.5 pl-4 pr-9 text-sm font-semibold text-neutral-700 outline-none transition-colors hover:border-(--primary) focus:border-(--primary) focus:ring-2 focus:ring-(--primary) sm:w-auto"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <FiChevronDown
          size={16}
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-neutral-500"
        />
      </div>
    </div>
  );
}
