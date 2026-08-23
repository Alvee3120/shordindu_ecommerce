"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { FiStar, FiTrash2, FiCheck } from "react-icons/fi";
import { listReviews, deleteReview, approveReview } from "@/lib/reviews";

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [approvingId, setApprovingId] = useState(null);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const data = await listReviews({ page: p });
      setReviews(data.results);
      setCount(data.count);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleDelete = async (id) => {
    if (!confirm("Delete this review?")) return;
    setDeletingId(id);
    try {
      await deleteReview(id);
      toast.success("Review deleted");
      setReviews((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleApprove = async (id) => {
    setApprovingId(id);
    try {
      const updated = await approveReview(id);
      toast.success("Review approved");
      setReviews((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setApprovingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(count / 20));

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-neutral-900">Reviews</h1>

      {loading ? (
        <p className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
          Loading reviews...
        </p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-neutral-500">No reviews yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-neutral-200 bg-white p-5"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <div className="flex text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <FiStar
                        key={i}
                        size={14}
                        fill={i < review.rating ? "currentColor" : "none"}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-neutral-400">
                    {new Date(review.created_at).toLocaleDateString()}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      review.status === "approved"
                        ? "bg-green-100 text-green-700"
                        : review.status === "rejected"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {review.status}
                  </span>
                </div>
                <p className="font-medium text-neutral-900">
                  {review.product_name || `Product #${review.product}`}
                </p>
                {review.comment && (
                  <p className="mt-1 text-sm text-neutral-600">{review.comment}</p>
                )}
                {review.image && (
                  <a
                    href={review.image}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative mt-2 block h-20 w-20 overflow-hidden rounded-lg border border-neutral-200"
                  >
                    <Image src={review.image} alt="" fill className="object-cover" sizes="80px" />
                  </a>
                )}
                <p className="mt-1 text-xs text-neutral-400">
                  by {review.user_name || `User #${review.user}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {review.status !== "approved" && (
                  <button
                    type="button"
                    onClick={() => handleApprove(review.id)}
                    disabled={approvingId === review.id}
                    className="flex items-center gap-1.5 text-sm font-medium text-green-600 hover:text-green-700 disabled:opacity-50"
                  >
                    <FiCheck size={14} />
                    {approvingId === review.id ? "Approving..." : "Approve"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(review.id)}
                  disabled={deletingId === review.id}
                  className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  <FiTrash2 size={14} />
                  {deletingId === review.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
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
