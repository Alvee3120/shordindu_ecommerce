"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { getAnnouncementConfig, updateAnnouncement } from "@/lib/announcementBar";
import { formatDateTime } from "@/lib/format";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const inputClass = (error) =>
  `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary) ${
    error ? "border-red-400" : "border-neutral-300"
  }`;

function toForm(config) {
  return {
    is_enabled: config.is_enabled,
    text: config.text ?? "",
    background_color: config.background_color ?? "#003333",
    text_color: config.text_color ?? "#FFFFFF",
  };
}

function ColorField({ id, label, value, onChange, error }) {
  const valid = HEX_RE.test(value || "");
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-neutral-700">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={valid ? value : "#000000"}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          aria-label={`${label} picker`}
          className="h-10 w-12 shrink-0 cursor-pointer rounded border border-neutral-300 bg-white p-1"
        />
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass(error)}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function AnnouncementBarAdminPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchConfig = () =>
    getAnnouncementConfig()
      .then((data) => {
        setConfig(data);
        setForm(toForm(data));
        setLoadError("");
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchConfig();
  }, []);

  if (user?.role !== "admin") {
    return <p className="text-sm text-neutral-500">Only administrators can manage the announcement bar.</p>;
  }

  if (loading && !form) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-48 rounded bg-neutral-200" />
        <div className="h-10 rounded bg-neutral-100" />
        <div className="h-40 rounded-xl bg-neutral-100" />
      </div>
    );
  }

  if (loadError && !form) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        <p>{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            fetchConfig();
          }}
          className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-red-50"
        >
          Retry
        </button>
      </div>
    );
  }

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (form.text.length > 300) next.text = "Keep the text under 300 characters.";
    ["background_color", "text_color"].forEach((field) => {
      if (!HEX_RE.test(form[field] || "")) next[field] = "Use a hex colour like #003333.";
    });
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
    setSaving(true);
    try {
      const result = await updateAnnouncement(form);
      setConfig(result);
      setForm(toForm(result));
      toast.success("Announcement bar saved.", {
        description: "The strip shows on the next page load.",
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

  return (
    <div className="pb-10">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Announcement Bar</h1>
        <p className="mt-1 text-sm text-neutral-500">
          A thin strip shown above the footer on every page.
          {config?.updated_at && (
            <span className="text-neutral-400"> · Last saved {formatDateTime(config.updated_at)}</span>
          )}
        </p>
      </div>

      <section className="mb-6 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-neutral-900">Preview</h2>
        <div
          className="w-full rounded-md px-4 py-2 text-center text-[11px] font-medium tracking-wide sm:text-xs"
          style={{ backgroundColor: form.background_color, color: form.text_color }}
        >
          {form.text.trim() || "Your announcement text will appear here."}
        </div>
        {!form.is_enabled && (
          <p className="mt-2 text-xs text-amber-700">The banner is turned off, so it won&apos;t appear on the site.</p>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-800">Show the announcement bar</p>
            <p className="text-xs text-neutral-500">Hidden completely when off.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.is_enabled}
            onClick={() => update("is_enabled", !form.is_enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              form.is_enabled ? "bg-(--primary)" : "bg-neutral-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                form.is_enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="text" className="mb-1 block text-xs font-medium text-neutral-700">
              Announcement text
            </label>
            <textarea
              id="text"
              rows={3}
              maxLength={300}
              value={form.text}
              onChange={(event) => update("text", event.target.value)}
              placeholder="Extra 10% OFF on a minimum cart value of 500 · Flat 15% OFF on your first order."
              className={inputClass(errors.text)}
            />
            <p className="mt-1 text-xs text-neutral-400">{form.text.length}/300 characters</p>
            {errors.text && <p className="mt-1 text-xs text-red-600">{errors.text}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ColorField
              id="background_color"
              label="Background colour"
              value={form.background_color}
              onChange={(value) => update("background_color", value)}
              error={errors.background_color}
            />
            <ColorField
              id="text_color"
              label="Text colour"
              value={form.text_color}
              onChange={(value) => update("text_color", value)}
              error={errors.text_color}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-(--primary) px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save & Publish"}
          </button>
        </div>
      </section>
    </div>
  );
}
