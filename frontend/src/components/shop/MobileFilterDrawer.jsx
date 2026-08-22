"use client";

import { useEffect } from "react";
import { FiX } from "react-icons/fi";
import FilterSidebar from "./FilterSidebar";

export default function MobileFilterDrawer({
  open,
  onClose,
  categoryList,
  filters,
  onSelectParent,
  onToggleChild,
  onPriceChange,
  onApply,
  onClear,
}) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div
      className={`fixed inset-0 z-[70] lg:hidden ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        className={`absolute top-0 left-0 h-full w-80 max-w-[85%] transform overflow-y-auto bg-white shadow-xl transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-4">
          <h2 className="font-sora text-lg font-semibold text-neutral-900">Filters</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="flex items-center justify-center rounded-md p-2 text-neutral-500 hover:bg-neutral-100"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="px-4 py-5">
          <FilterSidebar
            categoryList={categoryList}
            filters={filters}
            onSelectParent={onSelectParent}
            onToggleChild={onToggleChild}
            onPriceChange={onPriceChange}
            onApply={() => {
              onApply();
              onClose();
            }}
            onClear={onClear}
            showApplyButton
          />
        </div>
      </div>
    </div>
  );
}
