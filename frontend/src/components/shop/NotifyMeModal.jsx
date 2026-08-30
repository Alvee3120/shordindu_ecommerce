"use client";

import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { createStockNotification } from "@/lib/stockNotifications";

export default function NotifyMeModal({ open, onClose, product, variation, variationLabel }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(user?.name || "");
    setPhone(user?.phone || "");
    setNote("");
  }, [open, user]);

  if (!open || !product || !variation) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createStockNotification({
        product: product.id,
        variation: variation.id,
        customer_name: name.trim(),
        phone: phone.trim(),
        note: note.trim(),
      });
      toast.success("We’ll let you know when this item is back in stock.");
      onClose();
    } catch (error) {
      toast.error(error.message || "Could not save your request. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <form onSubmit={handleSubmit} className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute top-4 right-4 rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100"><FiX size={18} /></button>
        <h2 className="text-xl font-semibold text-neutral-900">Notify me</h2>
        <p className="mt-1 text-sm text-neutral-500">We’ll contact you when this option is back in stock.</p>

        <div className="mt-5 rounded-xl bg-neutral-50 p-3 text-sm">
          <p className="font-medium text-neutral-900">{product.name}</p>
          {variationLabel && <p className="mt-0.5 text-neutral-500">{variationLabel}</p>}
        </div>

        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-neutral-700">Customer name
            <input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-neutral-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-(--primary)" />
          </label>
          <label className="block text-sm font-medium text-neutral-700">Mobile number
            <input required type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1.5 w-full rounded-lg border border-neutral-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-(--primary)" />
          </label>
          <label className="block text-sm font-medium text-neutral-700">Additional note <span className="font-normal text-neutral-400">(optional)</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-1.5 w-full resize-none rounded-lg border border-neutral-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-(--primary)" />
          </label>
        </div>

        <button disabled={saving} className="mt-6 w-full rounded-full bg-(--primary) px-4 py-3 text-sm font-semibold text-white hover:bg-(--primary)/90 disabled:opacity-50">
          {saving ? "Saving..." : "Notify Me"}
        </button>
      </form>
    </div>
  );
}
