"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FiInfo, FiTruck } from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";
import { updateDeliveryCharges } from "@/lib/delivery";
import { formatBDT, formatDateTime } from "@/lib/format";
import { useDeliveryCharges } from "@/components/shared/useDeliveryCharges";

const FIELDS = [
  { key: "inside_dhaka", label: "Inside Dhaka", hint: "Dhaka district, Dhaka Sadar zone" },
  { key: "dhaka_outer_zones", label: "Dhaka Outer Zones", hint: "Other zones of Dhaka district" },
  { key: "outside_dhaka", label: "Outside Dhaka", hint: "Every other district" },
];

function toForm(config) {
  return Object.fromEntries(FIELDS.map(({ key }) => [key, String(Number(config[key]))]));
}

function validate(form) {
  const errors = {};
  FIELDS.forEach(({ key, label }) => {
    const raw = String(form[key] ?? "").trim();
    if (raw === "") errors[key] = `${label} charge is required.`;
    else if (!/^\d+(\.\d{1,2})?$/.test(raw)) errors[key] = "Enter a valid amount (0 or more, up to 2 decimals).";
  });
  return errors;
}

export default function DeliveryChargesPage() {
  const { user } = useAuth();
  const { config, loading, error, reload } = useDeliveryCharges();
  // null = untouched, so the form always shows the latest saved values.
  const [draft, setDraft] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const form = draft ?? (config ? toForm(config) : null);

  if (user?.role !== "admin") {
    return <p className="text-sm text-neutral-500">Only administrators can manage delivery charges.</p>;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setDraft({ ...form, [name]: value });
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const errors = validate(form);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    setSaving(true);
    try {
      await updateDeliveryCharges(form);
      toast.success("Delivery charges updated successfully.");
      setDraft(null);
      reload();
    } catch (err) {
      if (err.status === 400 && err.data) {
        setFieldErrors(Object.fromEntries(Object.entries(err.data).map(([k, v]) => [k, v?.[0] ?? v])));
      }
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const isDirty = Boolean(config && form) && FIELDS.some(({ key }) => Number(form[key]) !== Number(config[key]));

  return (
    <div className="max-w-3xl pb-10">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Delivery Charges</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Applied at checkout and to dashboard-created orders. Existing orders keep the charge they were placed with.
        </p>
      </div>

      {loading && !form ? (
        <div className="animate-pulse rounded-xl border border-neutral-200 bg-white p-5">
          <div className="mb-5 h-4 w-40 rounded bg-neutral-200" />
          <div className="grid gap-4 sm:grid-cols-3">
            {FIELDS.map(({ key }) => (
              <div key={key} className="space-y-2">
                <div className="h-3 w-24 rounded bg-neutral-200" />
                <div className="h-10 rounded-lg bg-neutral-100" />
              </div>
            ))}
          </div>
        </div>
      ) : error && !form ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-(--primary)/10 text-(--primary)">
              <FiTruck size={16} />
            </div>
            <h2 className="font-semibold text-neutral-900">Delivery Charges</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {FIELDS.map(({ key, label, hint }) => (
              <div key={key} className="min-w-0">
                <label htmlFor={key} className="mb-1.5 block text-sm font-medium text-neutral-700">
                  {label}
                </label>
                <div
                  className={`flex items-center rounded-lg border focus-within:ring-2 focus-within:ring-(--primary) ${
                    fieldErrors[key] ? "border-red-400" : "border-neutral-300"
                  }`}
                >
                  <span className="pl-3 text-sm text-neutral-500">৳</span>
                  <input
                    id={key}
                    name={key}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={form[key]}
                    onChange={handleChange}
                    disabled={saving}
                    className="w-full min-w-0 rounded-lg px-2 py-2.5 text-sm outline-none disabled:opacity-60"
                  />
                </div>
                {fieldErrors[key] ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors[key]}</p>
                ) : (
                  <p className="mt-1 text-xs text-neutral-400">
                    {hint} · now {formatBDT(config[key])}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-lg bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
            <p className="mb-1 flex items-center gap-1.5 font-medium text-neutral-700">
              <FiInfo size={13} /> Dhaka zones
            </p>
            {config.dhaka_zones.map((zone) => (
              <span key={zone.name} className="mr-3 inline-block">
                {zone.name} → {config.tier_labels[zone.tier]}
              </span>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
            <p className="text-xs text-neutral-400">
              {config.updated_at ? `Last updated ${formatDateTime(config.updated_at)}` : ""}
            </p>
            <button
              type="submit"
              disabled={saving || !isDirty}
              className="rounded-lg bg-(--primary) px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
