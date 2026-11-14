"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FiImage, FiMonitor, FiSmartphone, FiTrash2, FiUpload } from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";
import StatusBadge from "@/components/admin/StatusBadge";
import CampaignBannerView from "@/components/homepage/CampaignBannerView";
import { BANNER_REVALIDATE_SECONDS, getCampaignBannerConfig, updateCampaignBanner } from "@/lib/campaignBanner";
import { formatDateTime } from "@/lib/format";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const TEXT_FIELDS = ["eyebrow", "heading", "description", "image_alt", "button_label", "button_url"];
const STATUS_HELP = {
  live: "Showing on the homepage now.",
  scheduled: "Enabled, waiting for its start date.",
  ended: "Enabled, but its end date has passed.",
  disabled: "Hidden from the homepage.",
};

function toForm(config) {
  return {
    is_enabled: config.is_enabled,
    image_mode: config.image_mode,
    button_enabled: config.button_enabled,
    // The API returns Bangladesh time (+06:00), which is what the inputs show.
    starts_at: config.starts_at ? config.starts_at.slice(0, 16) : "",
    ends_at: config.ends_at ? config.ends_at.slice(0, 16) : "",
    ...Object.fromEntries(TEXT_FIELDS.map((field) => [field, config[field] ?? ""])),
  };
}

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

function ImagePicker({ label, hint, src, onPick, onRemove, error, id }) {
  const inputRef = useRef(null);
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-neutral-700">{label}</p>
      <div
        className={`relative flex aspect-16/7 items-center justify-center overflow-hidden rounded-lg border bg-neutral-50 ${
          error ? "border-red-400" : "border-neutral-200"
        }`}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs text-neutral-400">
            <FiImage size={20} />
            No image
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
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
            <FiTrash2 size={13} />
            Remove
          </button>
        )}
      </div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : <p className="mt-1 text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}

export default function CampaignBannerAdminPage() {
  const { user } = useAuth();
  const [saved, setSaved] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState(null);
  // Per image: { file, url } for a newly picked file, or { removed: true }.
  const [images, setImages] = useState({ desktop: null, mobile: null });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState("desktop");
  const objectUrls = useRef(new Set());

  const fetchConfig = useCallback(
    () =>
      getCampaignBannerConfig()
        .then((data) => {
          setSaved(data);
          setLoadError("");
        })
        .catch((err) => setLoadError(err.message))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const load = () => {
    setLoading(true);
    fetchConfig();
  };

  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  if (user?.role !== "admin") {
    return <p className="text-sm text-neutral-500">Only administrators can manage the campaign banner.</p>;
  }

  const form = draft ?? (saved ? toForm(saved) : null);

  const update = (field, value) => {
    setDraft({ ...form, [field]: value });
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
  };

  const imageSrc = (slot) => {
    const pending = images[slot];
    if (pending?.url) return pending.url;
    if (pending?.removed) return null;
    return saved?.[`${slot}_image_url`] ?? null;
  };

  const isDirty = Boolean(draft) || Boolean(images.desktop) || Boolean(images.mobile);

  const discard = () => {
    if (!confirm("Discard your unsaved changes?")) return;
    setDraft(null);
    setImages({ desktop: null, mobile: null });
    setErrors({});
  };

  const validate = () => {
    const next = {};
    if (!form.heading.trim()) next.heading = "A heading is required.";
    if (form.button_enabled) {
      if (!form.button_label.trim()) next.button_label = "Enter the button text, or turn the button off.";
      if (!form.button_url.trim()) next.button_url = "Enter where the button links to, or turn the button off.";
    }
    if (form.starts_at && form.ends_at && form.ends_at <= form.starts_at) {
      next.ends_at = "The end date must be after the start date.";
    }
    return next;
  };

  const handleSave = async () => {
    if (saving) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    const body = new FormData();
    body.append("is_enabled", String(form.is_enabled));
    body.append("button_enabled", String(form.button_enabled));
    body.append("image_mode", form.image_mode);
    body.append("starts_at", form.starts_at);
    body.append("ends_at", form.ends_at);
    TEXT_FIELDS.forEach((field) => body.append(field, form[field]));
    ["desktop", "mobile"].forEach((slot) => {
      if (images[slot]?.file) body.append(`${slot}_image`, images[slot].file);
      else if (images[slot]?.removed) body.append(`remove_${slot}_image`, "true");
    });

    setSaving(true);
    try {
      const result = await updateCampaignBanner(body);
      setSaved(result);
      setDraft(null);
      setImages({ desktop: null, mobile: null });
      setErrors({});
      toast.success("Campaign banner saved and published.", {
        description: `The homepage picks it up within about ${BANNER_REVALIDATE_SECONDS} seconds.`,
      });
    } catch (err) {
      if (err.status === 400 && err.data) {
        setErrors(Object.fromEntries(Object.entries(err.data).map(([key, value]) => [key, value?.[0] ?? value])));
      }
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !saved) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-56 rounded bg-neutral-200" />
        <div className="h-64 rounded-xl bg-neutral-100" />
        <div className="h-48 rounded-xl bg-neutral-100" />
      </div>
    );
  }

  if (loadError && !saved) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        <p>{loadError}</p>
        <button
          type="button"
          onClick={load}
          className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-red-50"
        >
          Retry
        </button>
      </div>
    );
  }

  const previewBanner = {
    ...form,
    desktop_image_url: imageSrc("desktop"),
    mobile_image_url: imageSrc("mobile"),
  };

  return (
    <div className="pb-24">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-neutral-900">Campaign Banner</h1>
            <StatusBadge value={saved.status} />
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            {STATUS_HELP[saved.status]}
            {saved.updated_at && (
              <span className="text-neutral-400">
                {" "}
                · Last published {formatDateTime(saved.updated_at)}
                {saved.updated_by_name ? ` by ${saved.updated_by_name}` : ""}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Preview */}
      <section className="mb-6 rounded-xl border border-neutral-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-neutral-900">Preview</h2>
            <p className="text-xs text-neutral-500">
              {isDirty ? "Showing your unsaved changes — not published until you save." : "Matches what's published."}
            </p>
          </div>
          <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
            {[
              { key: "desktop", label: "Desktop", icon: FiMonitor },
              { key: "mobile", label: "Mobile", icon: FiSmartphone },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setPreviewMode(key)}
                aria-pressed={previewMode === key}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  previewMode === key ? "bg-white text-(--primary) shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className={previewMode === "mobile" ? "mx-auto w-full max-w-[390px]" : "w-full"}>
          <div className="pointer-events-none overflow-hidden rounded-lg border border-neutral-200">
            <CampaignBannerView banner={previewBanner} variant={previewMode} contained />
          </div>
        </div>
        {!form.is_enabled && (
          <p className="mt-2 text-xs text-amber-700">The banner is turned off, so it won&apos;t appear on the homepage.</p>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Visibility */}
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-neutral-900">Visibility</h2>
          <div className="space-y-4">
            <Toggle
              id="is_enabled"
              checked={form.is_enabled}
              onChange={(value) => update("is_enabled", value)}
              label="Show banner on the homepage"
              description="When off, the homepage hides the banner completely."
            />
            <Field label="Images to use" htmlFor="image_mode">
              <select
                id="image_mode"
                value={form.image_mode}
                onChange={(e) => update("image_mode", e.target.value)}
                className={inputClass(errors.image_mode)}
              >
                <option value="responsive">Both — desktop image on desktop, mobile image on phones</option>
                <option value="desktop">Desktop image only (all screens)</option>
                <option value="mobile">Mobile image only (all screens)</option>
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Start (optional)" hint="Bangladesh time" error={errors.starts_at} htmlFor="starts_at">
                <input
                  id="starts_at"
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => update("starts_at", e.target.value)}
                  className={inputClass(errors.starts_at)}
                />
              </Field>
              <Field label="End (optional)" hint="Bangladesh time" error={errors.ends_at} htmlFor="ends_at">
                <input
                  id="ends_at"
                  type="datetime-local"
                  value={form.ends_at}
                  min={form.starts_at || undefined}
                  onChange={(e) => update("ends_at", e.target.value)}
                  className={inputClass(errors.ends_at)}
                />
              </Field>
            </div>
          </div>
        </section>

        {/* Images */}
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-neutral-900">Images</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <ImagePicker
              id="desktop_image"
              label="Desktop image"
              hint="Wide image, e.g. 1920×560. JPEG, PNG or WebP, max 5 MB."
              src={imageSrc("desktop")}
              onPick={(file) => pickImage("desktop", file)}
              onRemove={() => removeImage("desktop")}
              error={errors.desktop_image}
            />
            <ImagePicker
              id="mobile_image"
              label="Mobile image (optional)"
              hint="Taller image, e.g. 800×840. Falls back to the desktop image."
              src={imageSrc("mobile")}
              onPick={(file) => pickImage("mobile", file)}
              onRemove={() => removeImage("mobile")}
              error={errors.mobile_image}
            />
          </div>
          <Field
            label="Image description (alt text)"
            hint="Read by screen readers. Defaults to the heading."
            error={errors.image_alt}
            htmlFor="image_alt"
            className="mt-4"
          >
            <input
              id="image_alt"
              value={form.image_alt}
              maxLength={150}
              onChange={(e) => update("image_alt", e.target.value)}
              className={inputClass(errors.image_alt)}
            />
          </Field>
        </section>

        {/* Text */}
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-neutral-900">Text</h2>
          <div className="space-y-4">
            <Field label="Eyebrow text" hint="Small line above the heading, e.g. SEASONAL OFFER." error={errors.eyebrow} htmlFor="eyebrow">
              <input
                id="eyebrow"
                value={form.eyebrow}
                maxLength={60}
                onChange={(e) => update("eyebrow", e.target.value)}
                className={inputClass(errors.eyebrow)}
              />
            </Field>
            <Field label="Heading" hint="Each line becomes its own line on the banner (up to 4)." error={errors.heading} htmlFor="heading">
              <textarea
                id="heading"
                rows={3}
                value={form.heading}
                maxLength={120}
                onChange={(e) => update("heading", e.target.value)}
                className={inputClass(errors.heading)}
              />
            </Field>
            <Field label="Description" error={errors.description} htmlFor="description">
              <textarea
                id="description"
                rows={3}
                value={form.description}
                maxLength={300}
                onChange={(e) => update("description", e.target.value)}
                className={inputClass(errors.description)}
              />
            </Field>
          </div>
        </section>

        {/* Button */}
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-neutral-900">Button</h2>
          <div className="space-y-4">
            <Toggle
              id="button_enabled"
              checked={form.button_enabled}
              onChange={(value) => update("button_enabled", value)}
              label="Show button"
            />
            <Field label="Button text" error={errors.button_label} htmlFor="button_label">
              <input
                id="button_label"
                value={form.button_label}
                maxLength={40}
                disabled={!form.button_enabled}
                onChange={(e) => update("button_label", e.target.value)}
                className={`${inputClass(errors.button_label)} disabled:bg-neutral-50 disabled:text-neutral-400`}
              />
            </Field>
            <Field
              label="Button link"
              hint="A page on this site like /shop?category=3, or a full https:// link."
              error={errors.button_url}
              htmlFor="button_url"
            >
              <input
                id="button_url"
                value={form.button_url}
                maxLength={500}
                disabled={!form.button_enabled}
                onChange={(e) => update("button_url", e.target.value)}
                placeholder="/shop"
                className={`${inputClass(errors.button_url)} disabled:bg-neutral-50 disabled:text-neutral-400`}
              />
            </Field>
          </div>
        </section>
      </div>

      {/* Save bar */}
      <div className="sticky bottom-0 z-20 mt-6 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-neutral-200 bg-white/95 px-5 py-3 shadow-sm backdrop-blur">
        <p className="mr-auto text-xs text-neutral-500">
          {isDirty ? "You have unsaved changes." : "No unsaved changes."}
        </p>
        {isDirty && (
          <button
            type="button"
            onClick={discard}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
          >
            Discard
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="rounded-lg bg-(--primary) px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Publishing..." : "Save & Publish"}
        </button>
      </div>
    </div>
  );
}
