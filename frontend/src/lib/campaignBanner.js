// lib/campaignBanner.js — homepage campaign banners (content managed by admins).
import { apiFetch } from "./api";

/** Slots, in homepage order. Kept in sync with the backend CampaignBanner.Slot. */
export const CAMPAIGN_BANNER_SLOTS = [
  { value: 1, label: "Banner 1 — After categories" },
  { value: 2, label: "Banner 2 — Before Men" },
];

/**
 * Banners to show right now, ordered by slot. Disabled, scheduled-in-the-future
 * and expired banners come back omitted. Always fresh, so an admin's save
 * shows on the next homepage load. Returns [] if the backend is unreachable.
 */
export async function getActiveCampaignBanners() {
  try {
    const data = await apiFetch("/campaign-banners/", {
      method: "GET",
      cache: "no-store",
    });
    return Array.isArray(data?.banners) ? data.banners : [];
  } catch {
    return [];
  }
}

/** Admin only: the configuration of every banner slot. */
export function getCampaignBannerConfigs() {
  return apiFetch("/campaign-banners/manage/", { method: "GET" });
}

/** Admin only: save + publish one slot. `formData` carries text fields and new image files. */
export function updateCampaignBanner(slot, formData) {
  return apiFetch(`/campaign-banners/manage/${slot}/`, {
    method: "PUT",
    body: formData,
    isFormData: true,
  });
}
