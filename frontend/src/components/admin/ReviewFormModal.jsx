"use client";

import { useEffect, useRef, useState } from "react";
import { FiBox, FiRefreshCw, FiStar, FiTrash2, FiUpload, FiUser, FiX } from "react-icons/fi";
import { toast } from "sonner";
import ProductPicker from "@/components/cce/ProductPicker";
import { createManagedReview, updateManagedReview } from "@/lib/reviews";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STATUS_OPTIONS = [
  { value: "approved", label: "Published" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Hidden" },
];

const inputClass = (error) =>
  `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary) ${
    error ? "border-red-400" : "border-neutral-300"
  }`;

function todayISO() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function Field({ label, hint, error, htmlFor, children, className = "" }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-neutral-700">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-neutral-400">{hint}</p>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, label, description, id }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-neutral-800">
          {label}
        </label>
        {description && <p className="text-xs text-neutral-500">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-(--primary)" : "bg-neutral-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function StarSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
          className="cursor-pointer transition-transform hover:scale-110"
        >
          <FiStar
            size={26}
            className={
              star <= value ? "fill-amber-400 text-amber-400" : "text-neutral-300"
            }
          />
        </button>
      ))}
    </div>
  );
}

function formFrom(review) {
  return {
    customer_name: review?.customer_name || review?.display_name || "",
    customer_email: review?.customer_email || review?.user_email || "",
    rating: review?.rating ?? 5,
    title: review?.title || "",
    comment: review?.comment || "",
    review_date: review?.review_date || todayISO(),
    status: review?.status || "approved",
    verified_purchase: review?.verified_purchase ?? false,
  };
}

export default function ReviewFormModal({ review, onClose, onSaved }) {
  const isEdit = Boolean(review);
  const [form, setForm] = useState(() => formFrom(review));
  const [product, setProduct] = useState(
    review ? { id: review.product, name: review.product_name } : null
  );
  const [avatar, setAvatar] = useState(null);
  const [existingImages] = useState(review?.images || []);
  const [legacyImage] = useState(review?.image || null);
  const [legacyRemoved, setLegacyRemoved] = useState(false);
  const [removedImageIds, setRemovedImageIds] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const objectUrls = useRef(new Set());
  const overlayRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  // Pin the page while the modal is open so the background can't scroll.
  useEffect(() => {
    const scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const body = document.body.style;
    const previous = {
      position: body.position,
      top: body.top,
      left: body.left,
      right: body.right,
      width: body.width,
      paddingRight: body.paddingRight,
    };
    body.position = "fixed";
    body.top = `-${scrollY}px`;
    body.left = "0";
    body.right = "0";
    body.width = "100%";
    if (scrollbarWidth > 0) body.paddingRight = `${scrollbarWidth}px`;

    return () => {
      body.position = previous.position;
      body.top = previous.top;
      body.left = previous.left;
      body.right = previous.right;
      body.width = previous.width;
      body.paddingRight = previous.paddingRight;
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) return "Use a JPEG, PNG or WebP image.";
    if (file.size > MAX_BYTES) return "Images must be 5 MB or smaller.";
    return "";
  };

  const visibleExisting = existingImages.filter(
    (image) => !removedImageIds.includes(image.id)
  );
  const imageCount =
    visibleExisting.length + (legacyImage && !legacyRemoved ? 1 : 0) + newImages.length;
  const avatarSrc = avatar?.url ?? (avatar?.removed ? null : review?.avatar_url ?? null);

  const pickAvatar = (file) => {
    const error = validateFile(file);
    if (error) {
      setErrors((prev) => ({ ...prev, avatar: error }));
      return;
    }
    const url = URL.createObjectURL(file);
    objectUrls.current.add(url);
    setAvatar({ file, url });
    setErrors((prev) => ({ ...prev, avatar: undefined }));
  };

  const removeAvatar = () => {
    setAvatar({ removed: true });
    setErrors((prev) => ({ ...prev, avatar: undefined }));
  };

  const pickImages = (files) => {
    const incoming = Array.from(files || []);
    if (incoming.length === 0) return;
    if (imageCount + incoming.length > MAX_IMAGES) {
      setErrors((prev) => ({
        ...prev,
        images: `Use at most ${MAX_IMAGES} review images.`,
      }));
      return;
    }
    const next = [];
    for (const file of incoming) {
      const error = validateFile(file);
      if (error) {
        setErrors((prev) => ({ ...prev, images: error }));
        return;
      }
      const preview = URL.createObjectURL(file);
      objectUrls.current.add(preview);
      next.push({ key: `new-${Math.random().toString(36).slice(2)}`, file, preview });
    }
    setNewImages((prev) => [...prev, ...next]);
    setErrors((prev) => ({ ...prev, images: undefined }));
  };

  const removeNewImage = (key) => {
    setNewImages((prev) => {
      const target = prev.find((image) => image.key === key);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((image) => image.key !== key);
    });
  };

  const validate = () => {
    const next = {};
    if (!form.customer_name.trim()) next.customer_name = "Customer name is required.";
    if (form.customer_email.trim() && !EMAIL_RE.test(form.customer_email.trim())) {
      next.customer_email = "Enter a valid email address.";
    }
    if (!product) next.product = "Select a product.";
    if (!form.rating || form.rating < 1 || form.rating > 5) {
      next.rating = "Choose a rating from 1 to 5.";
    }
    if (!form.comment.trim()) next.comment = "Review description is required.";
    if (!form.review_date) next.review_date = "Choose a review date.";
    if (imageCount > MAX_IMAGES) next.images = `Use at most ${MAX_IMAGES} review images.`;
    return next;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    const body = new FormData();
    body.append("customer_name", form.customer_name.trim());
    body.append("customer_email", form.customer_email.trim());
    body.append("product", product.id);
    body.append("rating", String(form.rating));
    body.append("title", form.title.trim());
    body.append("comment", form.comment.trim());
    body.append("review_date", form.review_date);
    body.append("status", form.status);
    body.append("verified_purchase", String(form.verified_purchase));

    if (avatar?.file) body.append("avatar", avatar.file);
    else if (avatar?.removed) body.append("remove_avatar", "true");
    if (legacyRemoved && legacyImage) body.append("remove_legacy_image", "true");
    if (removedImageIds.length) body.append("remove_image_ids", removedImageIds.join(","));
    newImages.forEach((image) => body.append("images", image.file));

    setSubmitting(true);
    try {
      const saved = isEdit
        ? await updateManagedReview(review.id, body)
        : await createManagedReview(body);
      toast.success(isEdit ? "Review updated." : "Review created.");
      onSaved?.(saved);
      onClose();
    } catch (err) {
      if (err.status === 400 && err.data && typeof err.data === "object") {
        const flat = {};
        Object.entries(err.data).forEach(([key, value]) => {
          flat[key] = Array.isArray(value) ? value[0] : String(value);
        });
        setErrors(flat);
        setFormError(flat.non_field_errors || flat.detail || "");
      } else {
        setFormError(err.message || "Could not save the review.");
      }
      toast.error(err.message || "Could not save the review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-form-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => !submitting && onClose()}
        className="absolute inset-0 bg-black/40"
      />

      <form
        onSubmit={handleSubmit}
        noValidate
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <h2 id="review-form-title" className="text-lg font-semibold text-neutral-900">
              {isEdit ? "Edit review" : "Add review"}
            </h2>
            <p className="text-xs text-neutral-500">
              Published reviews appear on the product page immediately.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
          >
            <FiX size={18} />
          </button>
        </div>

        <div
          ref={contentRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4"
        >
          {formError && (
            <p className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {formError}
            </p>
          )}

          <section className="mb-5 rounded-xl border border-neutral-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-neutral-900">Customer</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Customer name" error={errors.customer_name} htmlFor="review-customer-name">
                <input
                  id="review-customer-name"
                  type="text"
                  value={form.customer_name}
                  onChange={(event) => update("customer_name", event.target.value)}
                  className={inputClass(errors.customer_name)}
                />
              </Field>
              <Field
                label="Customer email"
                hint="Optional"
                error={errors.customer_email}
                htmlFor="review-customer-email"
              >
                <input
                  id="review-customer-email"
                  type="email"
                  value={form.customer_email}
                  onChange={(event) => update("customer_email", event.target.value)}
                  className={inputClass(errors.customer_email)}
                />
              </Field>
            </div>
          </section>

          <section className="mb-5 rounded-xl border border-neutral-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-neutral-900">Product</h3>
            {product ? (
              <div className="mb-3 flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-neutral-400">
                  <FiBox size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">{product.name}</p>
                  <p className="text-xs text-neutral-500">Product #{product.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setProduct(null)}
                  className="rounded-full p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Clear selected product"
                >
                  <FiX size={16} />
                </button>
              </div>
            ) : null}
            <ProductPicker
              status={null}
              onSelectProduct={(selected) => {
                setProduct(selected);
                setErrors((prev) => ({ ...prev, product: undefined }));
              }}
              isProductSelected={(candidate) => candidate.id === product?.id}
            />
            {errors.product && <p className="mt-1 text-xs text-red-600">{errors.product}</p>}
          </section>

          <section className="mb-5 rounded-xl border border-neutral-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-neutral-900">Review</h3>
            <div className="space-y-3">
              <Field label="Rating" error={errors.rating}>
                <StarSelector value={form.rating} onChange={(value) => update("rating", value)} />
              </Field>
              <Field label="Review title" hint="Optional" error={errors.title} htmlFor="review-title">
                <input
                  id="review-title"
                  type="text"
                  maxLength={150}
                  value={form.title}
                  onChange={(event) => update("title", event.target.value)}
                  className={inputClass(errors.title)}
                />
              </Field>
              <Field label="Review description" error={errors.comment} htmlFor="review-comment">
                <textarea
                  id="review-comment"
                  rows={4}
                  value={form.comment}
                  onChange={(event) => update("comment", event.target.value)}
                  className={`${inputClass(errors.comment)} resize-none`}
                />
              </Field>
              <Field label="Review date" error={errors.review_date} htmlFor="review-date">
                <input
                  id="review-date"
                  type="date"
                  value={form.review_date}
                  onChange={(event) => update("review_date", event.target.value)}
                  className={inputClass(errors.review_date)}
                />
              </Field>
            </div>
          </section>

          <section className="mb-5 rounded-xl border border-neutral-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-neutral-900">Media</h3>

            <div className="mb-4">
              <p className="mb-1 text-xs font-medium text-neutral-700">Customer avatar</p>
              <div className="flex items-center gap-3">
                <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-50">
                  {avatarSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <FiUser size={22} className="text-neutral-300" />
                  )}
                </div>
                <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
                  <FiUpload size={13} />
                  {avatarSrc ? "Replace" : "Upload"}
                  <input
                    type="file"
                    accept={ALLOWED_TYPES.join(",")}
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) pickAvatar(file);
                    }}
                  />
                </label>
                {avatarSrc && (
                  <button
                    type="button"
                    onClick={removeAvatar}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    <FiTrash2 size={13} /> Remove
                  </button>
                )}
              </div>
              {errors.avatar && <p className="mt-1 text-xs text-red-600">{errors.avatar}</p>}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-neutral-700">Review images</p>
                <p className="text-[11px] text-neutral-400">
                  {imageCount}/{MAX_IMAGES}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {legacyImage && !legacyRemoved && (
                  <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-neutral-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={legacyImage} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setLegacyRemoved(true)}
                      aria-label="Remove image"
                      className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600"
                    >
                      <FiTrash2 size={11} />
                    </button>
                  </div>
                )}
                {visibleExisting.map((image) => (
                  <div
                    key={image.id}
                    className="relative h-20 w-20 overflow-hidden rounded-lg border border-neutral-200"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.image_url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() =>
                        setRemovedImageIds((prev) => [...prev, image.id])
                      }
                      aria-label="Remove image"
                      className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600"
                    >
                      <FiTrash2 size={11} />
                    </button>
                  </div>
                ))}
                {newImages.map((image) => (
                  <div
                    key={image.key}
                    className="relative h-20 w-20 overflow-hidden rounded-lg border border-neutral-200"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.preview} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeNewImage(image.key)}
                      aria-label="Remove image"
                      className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600"
                    >
                      <FiTrash2 size={11} />
                    </button>
                  </div>
                ))}
                {imageCount < MAX_IMAGES && (
                  <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-300 text-neutral-400 hover:border-(--primary) hover:text-(--primary)">
                    <FiUpload size={16} />
                    <span className="text-[10px] font-medium">Add</span>
                    <input
                      type="file"
                      accept={ALLOWED_TYPES.join(",")}
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        pickImages(event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
              {errors.images && <p className="mt-1 text-xs text-red-600">{errors.images}</p>}
            </div>
          </section>

          <section className="rounded-xl border border-neutral-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-neutral-900">Settings</h3>
            <div className="space-y-4">
              <Toggle
                id="review-verified"
                checked={form.verified_purchase}
                onChange={(value) => update("verified_purchase", value)}
                label="Verified purchase"
                description="The badge appears only if a delivered order matches this customer and product."
              />
              <Field label="Status" htmlFor="review-status">
                <select
                  id="review-status"
                  value={form.status}
                  onChange={(event) => update("status", event.target.value)}
                  className={inputClass(errors.status)}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-neutral-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-(--primary) px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <FiRefreshCw size={14} className="animate-spin" />}
            {submitting ? "Saving..." : isEdit ? "Save review" : "Add review"}
          </button>
        </div>
      </form>
    </div>
  );
}
