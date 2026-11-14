"use client";

import { useEffect, useRef, useState } from "react";
import { FiImage, FiRefreshCw, FiTrash2, FiUpload, FiX } from "react-icons/fi";
import { toast } from "sonner";
import HeroSlide from "@/components/homepage/HeroSlide";
import { createHeroBanner, updateHeroBanner } from "@/lib/heroBanners";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const HEX = /^#[0-9A-Fa-f]{6}$/;
const LINK = /^(\/|https?:\/\/)/i;

const inputClass = (error) =>
  `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary) ${
    error ? "border-red-400" : "border-neutral-300"
  }`;

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

function ColorField({ id, label, value, onChange, error }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-neutral-700">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={HEX.test(value) ? value : "#000000"}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-10 w-12 shrink-0 cursor-pointer rounded border border-neutral-300 bg-white p-1"
        />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="#FFFFFF"
          className={inputClass(error)}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ImageDropzone({ id, label, hint, src, onPick, onRemove, error }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-neutral-700">{label}</p>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) onPick(file);
        }}
        className={`relative flex aspect-16/7 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed ${
          dragging
            ? "border-(--primary) bg-(--primary)/5"
            : error
              ? "border-red-300 bg-red-50/40"
              : "border-neutral-300 bg-neutral-50"
        }`}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 px-4 text-center text-xs text-neutral-400">
            <FiImage size={20} />
            Drag &amp; drop an image here, or click to browse
          </span>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label={`Upload ${label}`}
          className="absolute inset-0 cursor-pointer"
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onPick(file);
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <FiUpload size={13} />
          {src ? "Replace" : "Upload"}
        </button>
        {src && (
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            <FiTrash2 size={13} /> Remove
          </button>
        )}
      </div>
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : (
        <p className="mt-1 text-xs text-neutral-400">{hint}</p>
      )}
    </div>
  );
}

function formFrom(banner) {
  return {
    bold_heading: banner?.bold_heading ?? "",
    normal_heading: banner?.normal_heading ?? "",
    text_color: banner?.text_color ?? "#FFFFFF",
    text_alignment: banner?.text_alignment ?? "center",
    show_text: banner?.show_text ?? true,
    button_text: banner?.button_text ?? "Shop Now",
    button_link: banner?.button_link ?? "/shop",
    button_background_color: banner?.button_background_color ?? "#003333",
    button_text_color: banner?.button_text_color ?? "#FFFFFF",
    button_radius: banner?.button_radius ?? 8,
    button_style: banner?.button_style ?? "solid",
    show_button: banner?.show_button ?? true,
    is_active: banner?.is_active ?? true,
    image_alt: banner?.image_alt ?? "",
  };
}

export default function HeroBannerEditor({ banner, onClose, onSaved }) {
  const isEdit = Boolean(banner);
  const [form, setForm] = useState(() => formFrom(banner));
  const [images, setImages] = useState({ desktop: null, mobile: null });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const objectUrls = useRef(new Set());

  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const pickImage = (slot, file) => {
    const field = `${slot}_image`;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, [field]: "Use a JPEG, PNG or WebP image." }));
      return;
    }
    if (file.size > MAX_BYTES) {
      setErrors((prev) => ({ ...prev, [field]: "Images must be 5 MB or smaller." }));
      return;
    }
    const url = URL.createObjectURL(file);
    objectUrls.current.add(url);
    setImages((prev) => ({ ...prev, [slot]: { file, url } }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const removeImage = (slot) => {
    setImages((prev) => ({ ...prev, [slot]: { removed: true } }));
    setErrors((prev) => ({ ...prev, [`${slot}_image`]: undefined }));
  };

  const imageSrc = (slot) => {
    const pending = images[slot];
    if (pending?.url) return pending.url;
    if (pending?.removed) return null;
    return banner?.[`${slot}_image_url`] ?? null;
  };

  const validate = () => {
    const next = {};
    if (!imageSrc("desktop")) next.desktop_image = "A desktop image is required.";
    for (const [field, label] of [
      ["text_color", "text colour"],
      ["button_background_color", "button background colour"],
      ["button_text_color", "button text colour"],
    ]) {
      if (!HEX.test(form[field])) next[field] = `Use a hex ${label} like #003333.`;
    }
    const radius = Number(form.button_radius);
    if (!Number.isFinite(radius) || radius < 0 || radius > 9999) {
      next.button_radius = "Use a radius between 0 and 9999 pixels.";
    }
    if (form.show_button) {
      if (!form.button_text.trim()) next.button_text = "Enter the button text, or hide the button.";
      if (!form.button_link.trim()) {
        next.button_link = "Enter where the button links to, or hide the button.";
      } else if (!LINK.test(form.button_link.trim())) {
        next.button_link = "Use a path like /shop or a full https:// URL.";
      }
    }
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
    [
      "bold_heading",
      "normal_heading",
      "text_color",
      "text_alignment",
      "button_text",
      "button_link",
      "button_background_color",
      "button_text_color",
      "button_style",
      "image_alt",
    ].forEach((field) => body.append(field, form[field]));
    body.append("button_radius", String(Number(form.button_radius)));
    ["show_text", "show_button", "is_active"].forEach((field) =>
      body.append(field, String(form[field]))
    );

    ["desktop", "mobile"].forEach((slot) => {
      if (images[slot]?.file) body.append(`${slot}_image`, images[slot].file);
      else if (images[slot]?.removed) body.append(`remove_${slot}_image`, "true");
    });

    setSaving(true);
    try {
      const saved = isEdit
        ? await updateHeroBanner(banner.id, body)
        : await createHeroBanner(body);
      toast.success(isEdit ? "Hero banner updated." : "Hero banner added.");
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
        setFormError(err.message || "Could not save the banner.");
      }
      toast.error(err.message || "Could not save the banner.");
    } finally {
      setSaving(false);
    }
  };

  const previewBanner = {
    ...form,
    desktop_image_url: imageSrc("desktop"),
    mobile_image_url: imageSrc("mobile"),
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hero-banner-editor-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => !saving && onClose()}
        className="absolute inset-0 bg-black/40"
      />

      <form
        onSubmit={handleSubmit}
        noValidate
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <h2 id="hero-banner-editor-title" className="text-lg font-semibold text-neutral-900">
              {isEdit ? "Edit hero banner" : "Add hero banner"}
            </h2>
            <p className="text-xs text-neutral-500">
              Changes publish to the homepage within about 30 seconds.
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {formError && (
            <p className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{formError}</p>
          )}

          <div className="mb-5 overflow-hidden rounded-xl border border-neutral-200">
            <div className="h-56 sm:h-72">
              <HeroSlide banner={previewBanner} preview />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-xl border border-neutral-200 p-4">
              <h3 className="mb-3 text-sm font-semibold text-neutral-900">Images</h3>
              <div className="space-y-4">
                <ImageDropzone
                  id="hero-desktop-image"
                  label="Desktop image"
                  hint="Recommended 1920×1080 or wider. JPEG, PNG or WebP, up to 5 MB."
                  src={imageSrc("desktop")}
                  onPick={(file) => pickImage("desktop", file)}
                  onRemove={() => removeImage("desktop")}
                  error={errors.desktop_image}
                />
                <ImageDropzone
                  id="hero-mobile-image"
                  label="Mobile image (optional)"
                  hint="Falls back to the desktop image when empty."
                  src={imageSrc("mobile")}
                  onPick={(file) => pickImage("mobile", file)}
                  onRemove={() => removeImage("mobile")}
                  error={errors.mobile_image}
                />
                <Field label="Image alt text" htmlFor="hero-image-alt">
                  <input
                    id="hero-image-alt"
                    type="text"
                    maxLength={150}
                    value={form.image_alt}
                    onChange={(event) => update("image_alt", event.target.value)}
                    className={inputClass(errors.image_alt)}
                  />
                </Field>
              </div>
            </section>

            <div className="space-y-5">
              <section className="rounded-xl border border-neutral-200 p-4">
                <h3 className="mb-3 text-sm font-semibold text-neutral-900">Text</h3>
                <div className="space-y-3">
                  <Field label="Bold heading" htmlFor="hero-bold-heading">
                    <input
                      id="hero-bold-heading"
                      type="text"
                      maxLength={120}
                      value={form.bold_heading}
                      onChange={(event) => update("bold_heading", event.target.value)}
                      placeholder="DISCOVER YOUR STYLE"
                      className={inputClass(errors.bold_heading)}
                    />
                  </Field>
                  <Field
                    label="Normal heading"
                    htmlFor="hero-normal-heading"
                    hint="Shown above the bold heading as a small uppercase line."
                  >
                    <input
                      id="hero-normal-heading"
                      type="text"
                      maxLength={160}
                      value={form.normal_heading}
                      onChange={(event) => update("normal_heading", event.target.value)}
                      placeholder="Explore the latest collection"
                      className={inputClass(errors.normal_heading)}
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ColorField
                      id="hero-text-color"
                      label="Text colour"
                      value={form.text_color}
                      onChange={(value) => update("text_color", value)}
                      error={errors.text_color}
                    />
                    <Field label="Text alignment" htmlFor="hero-text-alignment">
                      <select
                        id="hero-text-alignment"
                        value={form.text_alignment}
                        onChange={(event) => update("text_alignment", event.target.value)}
                        className={inputClass(errors.text_alignment)}
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </Field>
                  </div>
                  <Toggle
                    id="hero-show-text"
                    checked={form.show_text}
                    onChange={(value) => update("show_text", value)}
                    label="Show text"
                    description="Hide the headings and keep only the image/button."
                  />
                </div>
              </section>

              <section className="rounded-xl border border-neutral-200 p-4">
                <h3 className="mb-3 text-sm font-semibold text-neutral-900">Button</h3>
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Button text" htmlFor="hero-button-text">
                      <input
                        id="hero-button-text"
                        type="text"
                        maxLength={40}
                        value={form.button_text}
                        onChange={(event) => update("button_text", event.target.value)}
                        className={inputClass(errors.button_text)}
                      />
                    </Field>
                    <Field label="Button link" htmlFor="hero-button-link">
                      <input
                        id="hero-button-link"
                        type="text"
                        maxLength={500}
                        value={form.button_link}
                        onChange={(event) => update("button_link", event.target.value)}
                        placeholder="/shop"
                        className={inputClass(errors.button_link)}
                      />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ColorField
                      id="hero-button-bg"
                      label="Button background"
                      value={form.button_background_color}
                      onChange={(value) => update("button_background_color", value)}
                      error={errors.button_background_color}
                    />
                    <ColorField
                      id="hero-button-text-color"
                      label="Button text colour"
                      value={form.button_text_color}
                      onChange={(value) => update("button_text_color", value)}
                      error={errors.button_text_color}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Border radius (px)" htmlFor="hero-button-radius">
                      <input
                        id="hero-button-radius"
                        type="number"
                        min={0}
                        max={9999}
                        value={form.button_radius}
                        onChange={(event) => update("button_radius", event.target.value)}
                        className={inputClass(errors.button_radius)}
                      />
                    </Field>
                    <Field label="Style" htmlFor="hero-button-style">
                      <select
                        id="hero-button-style"
                        value={form.button_style}
                        onChange={(event) => update("button_style", event.target.value)}
                        className={inputClass(errors.button_style)}
                      >
                        <option value="solid">Solid</option>
                        <option value="outline">Outline</option>
                      </select>
                    </Field>
                  </div>
                  <Toggle
                    id="hero-show-button"
                    checked={form.show_button}
                    onChange={(value) => update("show_button", value)}
                    label="Show button"
                    description="Turn off to hide the CTA on this slide."
                  />
                </div>
              </section>

              <section className="rounded-xl border border-neutral-200 p-4">
                <Toggle
                  id="hero-active"
                  checked={form.is_active}
                  onChange={(value) => update("is_active", value)}
                  label="Enabled"
                  description="Inactive slides stay saved but are hidden from the homepage."
                />
              </section>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-neutral-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-(--primary) px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && <FiRefreshCw size={14} className="animate-spin" />}
            {saving ? "Saving..." : isEdit ? "Save banner" : "Add banner"}
          </button>
        </div>
      </form>
    </div>
  );
}
