"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { FiCheck, FiChevronLeft, FiChevronRight, FiImage, FiStar, FiX } from "react-icons/fi";
import InitialsAvatar from "@/components/admin/InitialsAvatar";
import { useAuth } from "@/context/AuthContext";
import { formatDate, formatNumber } from "@/lib/format";
import { createReview, listReviews } from "@/lib/reviews";

const PAGE_SIZE = 100;
const MAX_PAGES = 50;
const LOAD_MORE_COUNT = 5;

/**
 * The summary needs every approved review to build the rating distribution, so
 * this walks the paginated endpoint until it has them all. `status=approved`
 * is what keeps pending and hidden reviews out of the customer-facing numbers.
 */
async function fetchApprovedReviews(productId) {
  const collected = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const data = await listReviews({
      product: productId,
      status: "approved",
      page,
      page_size: PAGE_SIZE,
    });
    const results = Array.isArray(data) ? data : data?.results ?? [];
    collected.push(...results);

    // Unpaginated response, or we've reached the end.
    if (Array.isArray(data) || !data?.next || results.length === 0) break;

    page += 1;
  }

  return collected;
}

function Stars({ value, size = 16 }) {
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <FiStar
          key={n}
          size={size}
          className={n <= value ? "fill-current text-(--primary)" : "text-neutral-200"}
        />
      ))}
    </div>
  );
}

function StarPicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          aria-pressed={value === n}
          className="cursor-pointer p-0.5"
        >
          <FiStar
            size={28}
            className={n <= value ? "fill-current text-(--primary)" : "text-neutral-300"}
          />
        </button>
      ))}
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 className="font-serif text-xl font-medium text-neutral-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100"
          >
            <FiX size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function ReviewBody({ review }) {
  const images =
    review.images?.length > 0 ? review.images : review.image ? [review.image] : [];
  const name = review.display_name || review.user_name || "Customer";

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {review.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={review.avatar_url}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <InitialsAvatar name={name} id={review.id} />
          )}
          <div>
            <p className="font-semibold text-neutral-900">{name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Stars value={Number(review.rating) || 0} size={14} />
              <span className="text-xs text-neutral-400">
                {formatDate(review.review_date || review.created_at)}
              </span>
            </div>
          </div>
        </div>
        {review.is_verified_purchase && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            <FiCheck size={11} /> Verified purchase
          </span>
        )}
      </div>

      {review.title && (
        <p className="mt-4 font-semibold text-neutral-900">{review.title}</p>
      )}
      {review.comment && (
        <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-neutral-600">
          {review.comment}
        </p>
      )}

      {images.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {images.map((src, index) => (
            <div
              key={`${review.id}-${index}`}
              className="relative h-20 w-20 overflow-hidden rounded-lg border border-neutral-200"
            >
              <Image src={src} alt="" fill className="object-cover" sizes="80px" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewForm({ productId, userName, onSubmitted }) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Release the blob URL when the preview is replaced or the form unmounts.
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  function handleImageChange(event) {
    const file = event.target.files?.[0] || null;
    setImage(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  function clearImage() {
    setImage(null);
    setImagePreview(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!rating) {
      toast.error("Please select a rating.");
      return;
    }
    if (!comment.trim()) {
      toast.error("Please write your review.");
      return;
    }
    setSubmitting(true);
    try {
      await createReview({
        product: productId,
        rating,
        title: title.trim(),
        comment: comment.trim(),
        image,
      });
      setRating(5);
      setTitle("");
      setComment("");
      clearImage();
      toast.success("Review submitted for approval.");
      onSubmitted();
    } catch (err) {
      toast.error(err.message || "Could not post review.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {userName && (
        <p className="mb-3 text-sm text-neutral-500">
          Posting as <span className="font-semibold text-neutral-800">{userName}</span>
        </p>
      )}

      <p className="mb-1.5 text-sm font-medium text-neutral-700">Your rating</p>
      <StarPicker value={rating} onChange={setRating} />

      <label className="mt-4 block text-sm font-medium text-neutral-700">
        Title <span className="font-normal text-neutral-400">(optional)</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Sum it up in a few words"
          maxLength={150}
          className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm focus:border-(--primary) focus:outline-none"
        />
      </label>

      <label className="mt-3 block text-sm font-medium text-neutral-700">
        Review
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Share your thoughts about this product..."
          rows={4}
          className="mt-1.5 w-full resize-none rounded-lg border border-neutral-200 px-3 py-2.5 text-sm focus:border-(--primary) focus:outline-none"
        />
      </label>

      <div className="mt-3 flex items-center gap-3">
        <label className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-(--primary)">
          <FiImage size={16} />
          Add a photo
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
        </label>
        {imagePreview && (
          <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-neutral-200">
            <Image src={imagePreview} alt="" fill className="object-cover" sizes="56px" />
            <button
              type="button"
              onClick={clearImage}
              aria-label="Remove photo"
              className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <FiX size={10} />
            </button>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 w-full rounded-full bg-(--primary) px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit Review"}
      </button>
    </form>
  );
}

export default function ProductReviews({ productId }) {
  const { user, isAuthenticated } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [writeOpen, setWriteOpen] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(LOAD_MORE_COUNT);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    fetchApprovedReviews(productId)
      .then((data) => {
        if (!cancelled) setReviews(data);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, reloadKey]);

  // Refetch after a successful submission so the section reflects the store
  // without needing a hard refresh.
  function reload() {
    setLoading(true);
    setReloadKey((key) => key + 1);
  }

  // Newest first by creation date, with the id as a stable tiebreaker.
  const sortedReviews = useMemo(() => {
    return [...reviews].sort((a, b) => {
      const aTime = Date.parse(a.created_at || a.review_date || "") || 0;
      const bTime = Date.parse(b.created_at || b.review_date || "") || 0;
      if (bTime !== aTime) return bTime - aTime;
      return Number(b.id) - Number(a.id);
    });
  }, [reviews]);

  const distribution = useMemo(() => {
    const buckets = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    sortedReviews.forEach((review) => {
      const value = Number(review.rating);
      if (buckets[value] != null) buckets[value] += 1;
    });
    return buckets;
  }, [sortedReviews]);

  const totalReviews = sortedReviews.length;
  const averageRating = totalReviews
    ? sortedReviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) / totalReviews
    : 0;

  // Modulo keeps pagination wrapping in both directions without extra state.
  const safeIndex = totalReviews ? ((activeIndex % totalReviews) + totalReviews) % totalReviews : 0;
  const currentReview = sortedReviews[safeIndex] ?? null;
  const canNavigate = totalReviews > 1;

  const openAllReviews = () => {
    setVisibleCount(LOAD_MORE_COUNT);
    setAllOpen(true);
  };

  return (
    <section className="mt-16 border-t border-neutral-100 pt-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-serif text-3xl font-medium tracking-tight text-(--primary) sm:text-4xl">
          Rating &amp; Reviews
        </h2>
        <button
          type="button"
          onClick={() => setWriteOpen(true)}
          className="cursor-pointer rounded-full border border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:border-(--primary) hover:text-(--primary)"
        >
          Write a Review
        </button>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
        {/* Rating summary */}
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-10">
          <div className="shrink-0 sm:w-36">
            <div className="flex items-end gap-2">
              <span className="font-serif text-6xl leading-none text-neutral-900 sm:text-7xl">
                {averageRating.toFixed(1)}
              </span>
              <span className="pb-2 text-base text-neutral-500">/ 5</span>
            </div>
            <p className="mt-3 text-sm text-neutral-500">
              ({formatNumber(totalReviews)} Review{totalReviews === 1 ? "" : "s"})
            </p>
          </div>

          <div className="flex-1 space-y-3">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = distribution[star];
              const percent = totalReviews ? (count / totalReviews) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-3">
                  <span className="flex w-8 shrink-0 items-center gap-1 text-sm font-semibold text-neutral-800">
                    <FiStar size={12} className="fill-current text-(--primary)" />
                    {star}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-(--primary) transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-sm text-neutral-500">
                    {formatNumber(count)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Latest review card */}
        <div className="flex min-h-70 flex-col rounded-2xl border border-neutral-100 bg-white p-6 shadow-sm sm:p-8">
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-neutral-400">
              Loading reviews...
            </div>
          ) : !currentReview ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <p className="font-serif text-2xl text-neutral-800">No reviews yet</p>
              <p className="text-sm text-neutral-500">
                Be the first to share your thoughts on this product.
              </p>
            </div>
          ) : (
            <>
              <div className="flex-1">
                <ReviewBody review={currentReview} />
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
                {canNavigate ? (
                  <button
                    type="button"
                    onClick={openAllReviews}
                    className="cursor-pointer text-sm font-medium text-(--primary) hover:underline"
                  >
                    View all {formatNumber(totalReviews)} reviews
                  </button>
                ) : (
                  <span />
                )}

                {canNavigate && (
                  <div className="flex items-center gap-2">
                    <span className="mr-1 text-xs text-neutral-400">
                      {safeIndex + 1} of {formatNumber(totalReviews)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveIndex((index) => index - 1)}
                      aria-label="Previous review"
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition-colors hover:border-(--primary) hover:text-(--primary)"
                    >
                      <FiChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveIndex((index) => index + 1)}
                      aria-label="Next review"
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition-colors hover:border-(--primary) hover:text-(--primary)"
                    >
                      <FiChevronRight size={18} />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <Modal open={writeOpen} onClose={() => setWriteOpen(false)} title="Write a Review">
        {isAuthenticated ? (
          <ReviewForm
            productId={productId}
            userName={user?.name}
            onSubmitted={() => {
              setWriteOpen(false);
              reload();
            }}
          />
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm text-neutral-600">Please sign in to write a review.</p>
            <Link
              href="/auth/login"
              className="mt-4 inline-block rounded-full bg-(--primary) px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90"
            >
              Sign in
            </Link>
          </div>
        )}
      </Modal>

      <Modal
        open={allOpen}
        onClose={() => setAllOpen(false)}
        title={`Reviews (${formatNumber(totalReviews)})`}
      >
        <div className="space-y-6">
          {sortedReviews.slice(0, visibleCount).map((review) => (
            <div key={review.id} className="border-b border-neutral-100 pb-6 last:border-0 last:pb-0">
              <ReviewBody review={review} />
            </div>
          ))}
        </div>
        {visibleCount < totalReviews && (
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + LOAD_MORE_COUNT)}
            className="mt-6 w-full cursor-pointer rounded-full border border-neutral-200 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            Load more reviews
          </button>
        )}
      </Modal>
    </section>
  );
}
