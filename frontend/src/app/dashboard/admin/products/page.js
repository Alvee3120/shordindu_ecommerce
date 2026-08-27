"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiUpload, FiDownload } from "react-icons/fi";
import { listProducts, deleteProduct, bulkImportProducts, downloadImportTemplate } from "@/lib/products";

const statusColors = {
  draft: "bg-neutral-100 text-neutral-600",
  active: "bg-emerald-100 text-emerald-700",
  archived: "bg-red-100 text-red-700",
};

const visibilityLabels = {
  standalone: "Standalone",
  addon_only: "Addon only",
  both: "Both",
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const productData = await listProducts({ page, search: search || undefined });
      setProducts(productData.results);
      setCount(productData.count);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  // ---- Bulk import ----
  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      await downloadImportTemplate();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleImportFileChange = (e) => {
    setImportFile(e.target.files?.[0] || null);
    setImportResult(null);
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile) {
      toast.error("Choose an .xlsx file first");
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const result = await bulkImportProducts(importFile);
      setImportResult(result);
      setImportFile(null);

      const changed =
        result.created.products +
        result.updated.products +
        result.created.variations +
        result.updated.variations +
        result.created.addons +
        result.updated.addons;
      if (changed > 0) {
        toast.success(
          `${result.created.products} product(s) created, ${result.updated.products} updated`
        );
        setPage(1);
        await load();
      }
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} row(s) had errors - see details below`);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this product?")) return;
    setDeletingId(id);
    try {
      await deleteProduct(id);
      toast.success("Product deleted");
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(count / 20));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-neutral-900">Products</h1>
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2">
              <FiSearch size={14} className="text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products"
                className="w-40 bg-transparent text-sm outline-none"
              />
            </div>
          </form>
          <button
            type="button"
            onClick={() => setShowImport((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <FiUpload size={16} />
            Import from Excel
          </button>
          <Link
            href="/dashboard/admin/products/new"
            className="flex items-center gap-1.5 rounded-lg bg-(--primary) px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90"
          >
            <FiPlus size={16} />
            Add Product
          </Link>
        </div>
      </div>

      {showImport && (
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">Import Products from Excel</h2>
            <button
              type="button"
              onClick={() => {
                setShowImport(false);
                setImportResult(null);
                setImportFile(null);
              }}
              className="text-sm text-neutral-500 hover:text-neutral-700"
            >
              Close
            </button>
          </div>
          <p className="text-sm text-neutral-500">
            Download the template, fill in your products, variations, and addon links, then upload it
            here. Re-uploading the same file updates existing products matched by SKU instead of
            duplicating them. Images are still added per-product below after import.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              <FiDownload size={14} />
              {downloadingTemplate ? "Preparing..." : "Download template"}
            </button>
            <form onSubmit={handleImportSubmit} className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".xlsx"
                onChange={handleImportFileChange}
                className="text-sm text-neutral-600"
              />
              <button
                type="submit"
                disabled={importing || !importFile}
                className="flex items-center gap-1.5 rounded-lg bg-(--primary) px-4 py-2 text-sm font-semibold text-white hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiUpload size={14} />
                {importing ? "Importing..." : "Import"}
              </button>
            </form>
          </div>

          {importResult && (
            <div className="rounded-lg border border-neutral-200 p-4 text-sm">
              <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-neutral-700">
                <span>
                  Products: {importResult.created.products} created, {importResult.updated.products}{" "}
                  updated
                </span>
                <span>
                  Variations: {importResult.created.variations} created,{" "}
                  {importResult.updated.variations} updated
                </span>
                <span>
                  Addons: {importResult.created.addons} created, {importResult.updated.addons} updated
                </span>
              </div>
              {importResult.errors.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-red-200">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-red-200 bg-red-50 text-red-700">
                        <th className="px-3 py-2 font-medium">Sheet</th>
                        <th className="px-3 py-2 font-medium">Row</th>
                        <th className="px-3 py-2 font-medium">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.errors.map((err, idx) => (
                        <tr key={idx} className="border-b border-red-100 last:border-0">
                          <td className="px-3 py-2 whitespace-nowrap">{err.sheet}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{err.row}</td>
                          <td className="px-3 py-2 text-red-700">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
          Loading products...
        </p>
      ) : products.length === 0 ? (
        <p className="text-sm text-neutral-500">No products found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Visibility Type</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-5 py-3 font-medium text-neutral-900">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-gradient-to-br from-rose-100 via-violet-100 to-amber-100">
                        {(() => {
                          const image =
                            product.images?.find((item) => item.is_primary)?.image ||
                            product.images?.[0]?.image;

                          return image ? (
                            <Image
                              src={image}
                              alt={product.name}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center px-1 text-center text-[9px] font-medium leading-tight text-neutral-400">
                              No image
                            </div>
                          );
                        })()}
                      </div>
                      <span className="min-w-0 break-words">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-neutral-500">
                    {(product.category_names || []).join(", ") || "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                        statusColors[product.status] || "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-neutral-500">
                    {visibilityLabels[product.visibility_type] || product.visibility_type}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-4">
                      <Link
                        href={`/dashboard/admin/products/${product.id}`}
                        className="flex items-center gap-1.5 font-medium text-neutral-600 hover:text-(--primary)"
                      >
                        <FiEdit2 size={14} />
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(product.id)}
                        disabled={deletingId === product.id}
                        className="flex items-center gap-1.5 font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        <FiTrash2 size={14} />
                        {deletingId === product.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-neutral-500">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
