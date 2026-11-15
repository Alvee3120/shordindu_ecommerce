"use client";

import { useEffect, useState } from "react";
import { FiEdit2, FiPlus, FiSearch, FiStar, FiTrash2 } from "react-icons/fi";
import { toast } from "sonner";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import InitialsAvatar from "@/components/admin/InitialsAvatar";
import ReviewFormModal from "@/components/admin/ReviewFormModal";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/format";
import { deleteManagedReview, listManagedReviews, updateReviewStatus } from "@/lib/reviews";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "approved", label: "Published" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Hidden" },
];

const STATUS_STYLES = {
  approved: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  rejected: "bg-neutral-100 text-neutral-500",
};

function Stars({ value, size = 13 }) {
  return (
    <div className="flex text-amber-400">
      {Array.from({ length: 5 }).map((_, index) => (
        <FiStar key={index} size={size} fill={index < value ? "currentColor" : "none"} />
      ))}
    </div>
  );
}

export default function AdminReviewsPage() {
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "cce";

  const [reviews, setReviews] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const next = searchInput.trim();
      if (next !== search) {
        setLoading(true);
        setSearch(next);
        setPage(1);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchInput, search]);

  useEffect(() => {
    if (!canManage) return undefined;
    let cancelled = false;

    listManagedReviews({
      page,
      search: search || undefined,
      status: statusFilter || undefined,
      rating: ratingFilter || undefined,
      verified_purchase: verifiedFilter || undefined,
    })
      .then((data) => {
        if (cancelled) return;
        setReviews(data.results);
        setCount(data.count);
        setLoadError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err.message);
        toast.error(err.message);
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [page, search, statusFilter, ratingFilter, verifiedFilter, reloadKey, canManage]);

  if (user && !canManage) {
    return (
      <p className="text-sm text-neutral-500">Only administrators and CCEs can manage reviews.</p>
    );
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const refresh = () => {
    setLoading(true);
    setLoadError("");
    setReloadKey((value) => value + 1);
  };

  const handleSaved = (saved) => {
    if (editing && saved?.id) {
      setReviews((prev) => prev.map((review) => (review.id === saved.id ? saved : review)));
      setEditing(null);
      return;
    }
    setLoading(true);
    setPage(1);
    setReloadKey((value) => value + 1);
  };

  const handleStatusChange = async (review, status) => {
    setStatusUpdatingId(review.id);
    try {
      const updated = await updateReviewStatus(review.id, status);
      setReviews((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      toast.success("Review status updated.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await deleteManagedReview(deleting.id);
      toast.success("Review deleted.");
      setReviews((prev) => prev.filter((item) => item.id !== deleting.id));
      setCount((value) => Math.max(0, value - 1));
      setDeleting(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div className="pb-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Reviews</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Create and manage customer reviews. Published reviews appear on the product page.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <FiSearch
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search customer, product..."
              aria-label="Search reviews"
              className="w-full rounded-lg border border-neutral-300 py-2 pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => {
              setLoading(true);
              setPage(1);
              setStatusFilter(event.target.value);
            }}
            aria-label="Filter by status"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={ratingFilter}
            onChange={(event) => {
              setLoading(true);
              setPage(1);
              setRatingFilter(event.target.value);
            }}
            aria-label="Filter by rating"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
          >
            <option value="">All ratings</option>
            {[5, 4, 3, 2, 1].map((rating) => (
              <option key={rating} value={rating}>
                {rating} star{rating > 1 ? "s" : ""}
              </option>
            ))}
          </select>
          <select
            value={verifiedFilter}
            onChange={(event) => {
              setLoading(true);
              setPage(1);
              setVerifiedFilter(event.target.value);
            }}
            aria-label="Filter by verified purchase"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
          >
            <option value="">All purchases</option>
            <option value="true">Verified</option>
            <option value="false">Not verified</option>
          </select>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-lg bg-(--primary) px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90"
          >
            <FiPlus size={16} />
            Add Review
          </button>
        </div>
      </div>

      <div
        className={`overflow-x-auto rounded-xl border border-neutral-200 bg-white ${
          loading ? "opacity-60" : ""
        }`}
      >
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 whitespace-nowrap text-neutral-500">
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-5 py-3 font-medium">Product</th>
              <th className="px-5 py-3 font-medium">Rating</th>
              <th className="px-5 py-3 font-medium">Description</th>
              <th className="px-5 py-3 font-medium">Review Date</th>
              <th className="px-5 py-3 font-medium">Verified</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Created By</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && reviews.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-6 text-center text-neutral-500">
                  Loading reviews...
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={9} className="px-5 py-6 text-center text-red-600">
                  {loadError}{" "}
                  <button type="button" onClick={refresh} className="font-semibold underline">
                    Retry
                  </button>
                </td>
              </tr>
            ) : reviews.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-6 text-center text-neutral-500">
                  No reviews found.
                </td>
              </tr>
            ) : (
              reviews.map((review) => (
                <tr key={review.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {review.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={review.avatar_url}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <InitialsAvatar
                          id={review.id}
                          name={review.display_name}
                          email={review.customer_email || review.user_email}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-900">{review.display_name}</p>
                        <p className="text-xs text-neutral-500">
                          {review.customer_email || review.user_email || "No email"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-neutral-600">{review.product_name}</td>
                  <td className="px-5 py-3">
                    <Stars value={review.rating} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="max-w-xs">
                      {review.title && (
                        <p className="truncate text-xs font-semibold text-neutral-800">
                          {review.title}
                        </p>
                      )}
                      <p className="line-clamp-2 text-neutral-600">{review.comment || "—"}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-neutral-500">
                    {formatDate(review.review_date || review.created_at)}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        review.is_verified_purchase
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-neutral-100 text-neutral-500"
                      }`}
                      title="Shown only when the flag is on and a delivered purchase supports it."
                    >
                      {review.is_verified_purchase ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={review.status}
                      disabled={statusUpdatingId === review.id}
                      onChange={(event) => handleStatusChange(review, event.target.value)}
                      aria-label={`Status for ${review.display_name}'s review`}
                      className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold outline-none disabled:opacity-50 ${
                        STATUS_STYLES[review.status] || "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-neutral-500">
                    {review.created_by_name || "Customer"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-4">
                      <button
                        type="button"
                        onClick={() => setEditing(review)}
                        className="flex items-center gap-1.5 font-medium text-neutral-600 hover:text-(--primary)"
                      >
                        <FiEdit2 size={14} />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(review)}
                        className="flex items-center gap-1.5 font-medium text-red-600 hover:text-red-700"
                      >
                        <FiTrash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => {
              setLoading(true);
              setPage((value) => value - 1);
            }}
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
            onClick={() => {
              setLoading(true);
              setPage((value) => value + 1);
            }}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {creating && (
        <ReviewFormModal
          review={null}
          onClose={() => setCreating(false)}
          onSaved={handleSaved}
        />
      )}

      {editing && (
        <ReviewFormModal
          review={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete review"
          message={`Delete the review by ${deleting.display_name}? This can't be undone.`}
          confirmLabel="Delete review"
          loading={deletingBusy}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
