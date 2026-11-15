"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { FiCheck, FiImage, FiStar, FiX } from "react-icons/fi";
import InitialsAvatar from "@/components/admin/InitialsAvatar";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/format";
import { listReviews, createReview } from "@/lib/reviews";

function StarRow({ value, onChange, size = 18 }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={onChange ? () => onChange(n) : undefined}
          disabled={!onChange}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={onChange ? "cursor-pointer" : "cursor-default"}
        >
          <FiStar
            size={size}
            className={n <= value ? "fill-amber-400 text-amber-400" : "text-neutral-300"}
          />
        </button>
      ))}
    </div>
  );
}

export default function ProductReviews({ productId, averageRating, reviewCount = 0 }) {
  const { user, isAuthenticated } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    listReviews({ product: productId, status: "approved" })
      .then((data) => {
        if (cancelled) return;
        const results = Array.isArray(data) ? data : data?.results ?? [];
        setReviews(results.slice(0, 3));
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
  }, [productId]);

  function handleImageChange(e) {
    const file = e.target.files?.[0] || null;
    setImage(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  function clearImage() {
    setImage(null);
    setImagePreview(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!rating) {
      toast.error("Please select a rating.");
      return;
    }
    setSubmitting(true);
    try {
      await createReview({ product: productId, rating, comment, image });
      setRating(5);
      setComment("");
      clearImage();
      toast.success("Review submitted for approval.");
    } catch (err) {
      toast.error(err.message || "Could not post review.");
    } finally {
      setSubmitting(false);
    }
  }

  const numericRating = Number(averageRating);
  const numericCount = Number(reviewCount) || 0;

  return (
    <div className="mt-16 border-t border-neutral-100 pt-10">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h2 className="font-sora text-2xl font-bold text-neutral-900">Reviews</h2>
        {numericCount > 0 && Number.isFinite(numericRating) && (
          <div className="flex items-center gap-2">
            <StarRow value={Math.round(numericRating)} size={16} />
            <span className="text-sm font-semibold text-neutral-800">
              {numericRating.toFixed(1)}
            </span>
            <span className="text-sm text-neutral-500">
              ({numericCount} review{numericCount === 1 ? "" : "s"})
            </span>
          </div>
        )}
      </div>

      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="mb-10 rounded-2xl border border-neutral-100 p-5">
          <p className="mb-3 text-sm font-medium text-neutral-700">
            Posting as <span className="font-semibold">{user?.name}</span>
          </p>
          <StarRow value={rating} onChange={setRating} size={22} />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your thoughts about this product..."
            rows={3}
            className="mt-3 w-full resize-none rounded-xl border border-neutral-200 p-3 text-sm focus:border-(--primary) focus:outline-none"
          />

          <div className="mt-3 flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-(--primary)">
              <FiImage size={16} />
              Add a photo
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
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
            className="mt-4 rounded-full bg-neutral-900 px-6 py-2 text-sm font-semibold tracking-wide text-white uppercase transition-colors hover:bg-(--primary) disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Posting..." : "Post review"}
          </button>
        </form>
      ) : (
        <p className="mb-10 text-sm text-neutral-500">
          Please sign in to write a review.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-neutral-500">Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-neutral-500">No reviews yet. Be the first to review this product.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {reviews.map((review) => {
            const images =
              review.images?.length > 0
                ? review.images
                : review.image
                  ? [review.image]
                  : [];
            const name = review.display_name || review.user_name || "Customer";
            return (
              <div key={review.id} className="border-b border-neutral-100 pb-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {review.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={review.avatar_url}
                        alt=""
                        className="h-9 w-9 rounded-full object-cover"
                      />
                    ) : (
                      <InitialsAvatar name={name} id={review.id} />
                    )}
                    <div>
                      <p className="font-semibold text-neutral-900">{name}</p>
                      {review.is_verified_purchase && (
                        <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          <FiCheck size={11} /> Verified purchase
                        </span>
                      )}
                    </div>
                  </div>
                  <StarRow value={review.rating} />
                </div>

                {review.title && (
                  <p className="mt-3 text-sm font-semibold text-neutral-900">{review.title}</p>
                )}
                {review.comment && (
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">{review.comment}</p>
                )}

                {images.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {images.map((src, index) => (
                      <div
                        key={`${review.id}-${index}`}
                        className="relative h-24 w-24 overflow-hidden rounded-lg border border-neutral-200"
                      >
                        <Image
                          src={src}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="96px"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <p className="mt-2 text-xs text-neutral-400">
                  {formatDate(review.review_date || review.created_at)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
