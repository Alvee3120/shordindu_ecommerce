"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FiChevronDown,
  FiChevronUp,
  FiEdit2,
  FiImage,
  FiMenu,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
} from "react-icons/fi";
import { toast } from "sonner";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import HeroBannerEditor from "@/components/admin/HeroBannerEditor";
import { useAuth } from "@/context/AuthContext";
import {
  deleteHeroBanner,
  getHeroBannerConfig,
  getHeroBannerSettings,
  reorderHeroBanners,
  updateHeroBanner,
  updateHeroBannerSettings,
} from "@/lib/heroBanners";

const MAX_BANNERS = 3;

function Toggle({ checked, onChange, label, id, disabled = false }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-(--primary)" : "bg-neutral-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function HeroBannersAdminPage() {
  const { user } = useAuth();
  const [banners, setBanners] = useState([]);
  const [delaySeconds, setDelaySeconds] = useState("5");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [deletingBanner, setDeletingBanner] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);

  const applyData = useCallback((list, settings) => {
    setBanners(Array.isArray(list) ? list : []);
    const seconds = Math.round((settings?.autoplay_delay_ms ?? 5000) / 1000);
    setDelaySeconds(String(Math.min(15, Math.max(2, seconds))));
    setLoadError("");
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [list, settings] = await Promise.all([
        getHeroBannerConfig(),
        getHeroBannerSettings(),
      ]);
      applyData(list, settings);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [applyData]);

  const refresh = () => {
    setLoading(true);
    fetchAll();
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([getHeroBannerConfig(), getHeroBannerSettings()])
      .then(([list, settings]) => {
        if (!cancelled) applyData(list, settings);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyData]);

  if (user?.role !== "admin") {
    return <p className="text-sm text-neutral-500">Only administrators can manage hero banners.</p>;
  }

  const openCreate = () => {
    setEditingBanner(null);
    setEditorOpen(true);
  };

  const openEdit = (banner) => {
    setEditingBanner(banner);
    setEditorOpen(true);
  };

  const handleToggle = async (banner) => {
    setTogglingId(banner.id);
    try {
      const updated = await updateHeroBanner(banner.id, { is_active: !banner.is_active });
      setBanners((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      toast.success(updated.is_active ? "Banner enabled" : "Banner disabled");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingBanner) return;
    setDeleting(true);
    try {
      await deleteHeroBanner(deletingBanner.id);
      toast.success("Hero banner deleted.");
      setDeletingBanner(null);
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const persistOrder = async (next) => {
    const previous = banners;
    setBanners(next);
    try {
      const saved = await reorderHeroBanners(next.map((item) => item.id));
      setBanners(Array.isArray(saved) ? saved : next);
      toast.success("Banner order saved.");
    } catch (err) {
      setBanners(previous);
      toast.error(err.message);
    }
  };

  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= banners.length) return;
    const next = [...banners];
    [next[index], next[target]] = [next[target], next[index]];
    persistOrder(next);
  };

  const handleDrop = (index) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      return;
    }
    const next = [...banners];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    setDragIndex(null);
    persistOrder(next);
  };

  const saveSettings = async () => {
    const seconds = Number(delaySeconds);
    if (!Number.isFinite(seconds) || seconds < 2 || seconds > 15) {
      toast.error("Autoplay delay must be between 2 and 15 seconds.");
      return;
    }
    setSavingSettings(true);
    try {
      await updateHeroBannerSettings({ autoplay_delay_ms: Math.round(seconds * 1000) });
      toast.success("Carousel settings saved.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading && banners.length === 0 && !loadError) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-56 rounded bg-neutral-200" />
        <div className="h-24 rounded-xl bg-neutral-100" />
        <div className="h-40 rounded-xl bg-neutral-100" />
        <div className="h-40 rounded-xl bg-neutral-100" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        <p>{loadError}</p>
        <button
          type="button"
          onClick={refresh}
          className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-red-50"
        >
          Retry
        </button>
      </div>
    );
  }

  const atLimit = banners.length >= MAX_BANNERS;

  return (
    <div className="pb-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Hero Banners</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Up to {MAX_BANNERS} homepage slides, shown in this order. {banners.length} of{" "}
            {MAX_BANNERS} used.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <FiRefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreate}
            disabled={atLimit}
            title={atLimit ? `You can add at most ${MAX_BANNERS} hero banners.` : undefined}
            className="flex items-center gap-1.5 rounded-lg bg-(--primary) px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiPlus size={16} />
            Add New Banner
          </button>
        </div>
      </div>

      <section className="mb-6 rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold text-neutral-900">Carousel</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Autoplay is used only when more than one banner is active.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label
                htmlFor="hero-autoplay-delay"
                className="mb-1 block text-xs font-medium text-neutral-700"
              >
                Autoplay delay (seconds)
              </label>
              <input
                id="hero-autoplay-delay"
                type="number"
                min={2}
                max={15}
                value={delaySeconds}
                onChange={(event) => setDelaySeconds(event.target.value)}
                className="w-32 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
              />
            </div>
            <button
              type="button"
              onClick={saveSettings}
              disabled={savingSettings}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              {savingSettings ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </section>

      {banners.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <FiImage size={24} className="mx-auto text-neutral-300" />
          <p className="mt-2 text-sm font-medium text-neutral-700">No hero banners yet.</p>
          <p className="mt-1 text-sm text-neutral-500">
            Add up to {MAX_BANNERS} slides for the homepage hero.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-(--primary) px-4 py-2 text-sm font-semibold text-white hover:bg-(--primary)/90"
          >
            <FiPlus size={16} /> Add New Banner
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((banner, index) => (
            <article
              key={banner.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(index)}
              onDragEnd={() => setDragIndex(null)}
              className={`flex flex-col gap-4 rounded-xl border bg-white p-4 transition-shadow sm:flex-row ${
                dragIndex === index
                  ? "border-(--primary) opacity-60 shadow-md"
                  : "border-neutral-200"
              }`}
            >
              <div className="flex items-center gap-2 text-neutral-400 sm:flex-col sm:items-center sm:justify-center">
                <FiMenu size={16} className="cursor-grab" aria-label="Drag to reorder" />
                <div className="flex gap-1 sm:flex-col">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Move up"
                    className="rounded-md p-1 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
                  >
                    <FiChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === banners.length - 1}
                    aria-label="Move down"
                    className="rounded-md p-1 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
                  >
                    <FiChevronDown size={16} />
                  </button>
                </div>
              </div>

              <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 sm:w-48">
                {banner.desktop_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={banner.desktop_image_url}
                    alt={banner.image_alt || banner.bold_heading || ""}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-neutral-300">
                    <FiImage size={22} />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {banner.bold_heading || "Untitled banner"}
                    </p>
                    <p className="truncate text-sm text-neutral-500">
                      {banner.normal_heading || "No secondary heading"}
                    </p>
                    <p className="mt-1 text-xs text-neutral-400">
                      {banner.show_button && banner.button_text
                        ? `Button: “${banner.button_text}” → ${banner.button_link}`
                        : "Button hidden"}
                    </p>
                  </div>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500">
                    Position {index + 1}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-3">
                  <div className="flex items-center gap-2">
                    <Toggle
                      id={`hero-active-${banner.id}`}
                      checked={banner.is_active}
                      onChange={() => handleToggle(banner)}
                      disabled={togglingId === banner.id}
                      label={`Toggle ${banner.bold_heading || "banner"}`}
                    />
                    <span className="text-xs font-medium text-neutral-600">
                      {banner.is_active ? "Enabled" : "Disabled"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(banner)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-(--primary)"
                    >
                      <FiEdit2 size={13} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingBanner(banner)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      <FiTrash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editorOpen && (
        <HeroBannerEditor
          banner={editingBanner}
          onClose={() => {
            setEditorOpen(false);
            setEditingBanner(null);
          }}
          onSaved={refresh}
        />
      )}

      {deletingBanner && (
        <ConfirmDialog
          title="Delete hero banner"
          message={`Delete “${deletingBanner.bold_heading || "this banner"}”? This can't be undone.`}
          confirmLabel="Delete banner"
          loading={deleting}
          onCancel={() => setDeletingBanner(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
