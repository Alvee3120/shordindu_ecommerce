"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FiFilter, FiX } from "react-icons/fi";
import ProductCard from "@/components/ProductCard";
import FilterSidebar from "@/components/shop/FilterSidebar";
import MobileFilterDrawer from "@/components/shop/MobileFilterDrawer";
import Pagination from "@/components/shop/Pagination";
import { listProducts, toCardProduct } from "@/lib/products";
import { getCategories } from "@/lib/categories";

const PAGE_SIZE = 12;

function ShopPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlSearch = searchParams.get("search") || "";
  const urlParentCategory = searchParams.get("category") || ""; // single active parent id
  const urlSubcategories = searchParams.get("subcategories") || ""; // comma-separated child ids
  const urlMinPrice = searchParams.get("min_price") || "";
  const urlMaxPrice = searchParams.get("max_price") || "";
  const urlPage = Number(searchParams.get("page") || "1");

  const [categoryList, setCategoryList] = useState([]);
  const [products, setProducts] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Set right before a clearFilters()-driven URL update, so the debounced
  // auto-apply effect below doesn't fire on stale searchParams and stomp it
  // (that stale-fire was how "Clear All" used to leave `search` behind).
  const skipAutoApplyRef = useRef(false);

  // Draft filters (mirror URL, edited locally, committed via updateUrl/applyFilters)
  const [draftFilters, setDraftFilters] = useState({
    parentCategory: urlParentCategory,
    childCategories: urlSubcategories ? urlSubcategories.split(",") : [],
    minPrice: urlMinPrice,
    maxPrice: urlMaxPrice,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing draft filters from URL params
    setDraftFilters({
      parentCategory: urlParentCategory,
      childCategories: urlSubcategories ? urlSubcategories.split(",") : [],
      minPrice: urlMinPrice,
      maxPrice: urlMaxPrice,
    });
  }, [urlParentCategory, urlSubcategories, urlMinPrice, urlMaxPrice]);

  useEffect(() => {
    getCategories()
      .then((data) => setCategoryList(Array.isArray(data) ? data : data?.results ?? []))
      .catch(() => setCategoryList([]));
  }, []);

  // Child selections narrow the filter to exactly those children; with no
  // child selected, an active parent expands to itself + all its children.
  const resolveCategoryParam = useCallback(
    (parentCategory, childCategories) => {
      if (childCategories.length > 0) return childCategories.join(",");
      if (!parentCategory) return undefined;
      const childIds = categoryList
        .filter((c) => String(c.parent) === String(parentCategory))
        .map((c) => String(c.id));
      return [parentCategory, ...childIds].join(",");
    },
    [categoryList]
  );

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicking off loading state for the fetch below
    setLoading(true);
    const categoryParam = resolveCategoryParam(
      urlParentCategory,
      urlSubcategories ? urlSubcategories.split(",") : []
    );
    listProducts({
      page: urlPage,
      page_size: PAGE_SIZE,
      search: urlSearch || undefined,
      category: categoryParam,
      min_price: urlMinPrice || undefined,
      max_price: urlMaxPrice || undefined,
    })
      .then((data) => {
        if (cancelled) return;
        const results = Array.isArray(data) ? data : data?.results ?? [];
        setProducts(results.map(toCardProduct));
        setCount(Array.isArray(data) ? results.length : data?.count ?? results.length);
      })
      .catch(() => {
        if (!cancelled) {
          setProducts([]);
          setCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [urlSearch, urlParentCategory, urlSubcategories, urlMinPrice, urlMaxPrice, urlPage, resolveCategoryParam]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const updateUrl = useCallback(
    (updates) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      router.push(`/shop?${params.toString()}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [router, searchParams]
  );

  // Selecting a parent sets it as the active scope and clears any child
  // selection — child checkboxes stay unchecked until explicitly picked.
  const handleSelectParent = (parentId) => {
    setDraftFilters((prev) => {
      const id = String(parentId);
      const isActive = prev.parentCategory === id;
      return { ...prev, parentCategory: isActive ? "" : id, childCategories: [] };
    });
  };

  // Child selection is additive (one or more children can be checked) and
  // narrows the grid to strictly those children.
  const handleToggleChild = (childId) => {
    setDraftFilters((prev) => {
      const id = String(childId);
      const exists = prev.childCategories.includes(id);
      const childCategories = exists
        ? prev.childCategories.filter((c) => c !== id)
        : [...prev.childCategories, id];
      return { ...prev, childCategories };
    });
  };

  const handlePriceChange = (key, value) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    updateUrl({
      category: draftFilters.parentCategory || undefined,
      subcategories: draftFilters.childCategories.join(",") || undefined,
      min_price: draftFilters.minPrice || undefined,
      max_price: draftFilters.maxPrice || undefined,
      page: 1,
    });
  };

  const clearFilters = () => {
    skipAutoApplyRef.current = true;
    setDraftFilters({ parentCategory: "", childCategories: [], minPrice: "", maxPrice: "" });
    updateUrl({
      search: undefined,
      category: undefined,
      subcategories: undefined,
      min_price: undefined,
      max_price: undefined,
      page: 1,
    });
  };

  // Auto-apply on desktop (no separate Apply button there)
  useEffect(() => {
    if (drawerOpen) return; // mobile applies explicitly
    if (skipAutoApplyRef.current) {
      // clearFilters() already pushed the correct (fully-cleared) URL directly;
      // skip this one round so it can't re-fire off stale searchParams and undo it.
      skipAutoApplyRef.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      const same =
        urlParentCategory === draftFilters.parentCategory &&
        (urlSubcategories ? urlSubcategories.split(",") : []).join(",") ===
          draftFilters.childCategories.join(",") &&
        urlMinPrice === draftFilters.minPrice &&
        urlMaxPrice === draftFilters.maxPrice;
      if (!same) applyFilters();
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftFilters]);

  const heading = useMemo(() => {
    if (urlSearch) return `Search results for “${urlSearch}”`;
    return "Shop";
  }, [urlSearch]);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-28 sm:pt-24 pb-16 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-sora truncate text-2xl font-bold text-neutral-900 sm:text-3xl">{heading}</h1>
          <p className="mt-1 text-sm text-neutral-500">{count} products found</p>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex shrink-0 items-center gap-2 rounded-full border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-(--primary) hover:text-white lg:hidden"
        >
          <FiFilter size={16} />
          Filter
        </button>
      </div>

      {urlSearch && (
        <button
          type="button"
          onClick={() => updateUrl({ search: undefined, page: 1 })}
          className="mb-6 flex items-center gap-1.5 rounded-full bg-(--primary) px-3 py-1.5 text-xs font-medium text-white hover:bg-(--primary)/90"
        >
          {urlSearch}
          <FiX size={12} />
        </button>
      )}

      <div className="flex items-start gap-8">
        <aside className="sticky top-28 hidden w-64 shrink-0 lg:block">
          <FilterSidebar
            categoryList={categoryList}
            filters={draftFilters}
            onSelectParent={handleSelectParent}
            onToggleChild={handleToggleChild}
            onPriceChange={handlePriceChange}
            onApply={applyFilters}
            onClear={clearFilters}
          />
        </aside>

        <div className="sm:-mt-20 min-w-0 flex-1">
          {loading ? (
            <div className="grid min-h-screen grid-cols-2 gap-6 sm:grid-cols-3 ">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <div key={i} className="aspect-[4/5.6] animate-pulse rounded-3xl bg-(--primary)/10" />
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 ">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-neutral-200 py-24 text-center">
              <p className="font-sora text-lg font-semibold text-neutral-700">No products found</p>
              <p className="mt-1 text-sm text-neutral-500">Try adjusting your search or filters.</p>
            </div>
          )}

          <Pagination
            currentPage={urlPage}
            totalPages={totalPages}
            onPageChange={(p) => updateUrl({ page: p })}
          />
        </div>
      </div>

      <MobileFilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        categoryList={categoryList}
        filters={draftFilters}
        onSelectParent={handleSelectParent}
        onToggleChild={handleToggleChild}
        onPriceChange={handlePriceChange}
        onApply={applyFilters}
        onClear={clearFilters}
      />
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={null}>
      <ShopPageContent />
    </Suspense>
  );
}
