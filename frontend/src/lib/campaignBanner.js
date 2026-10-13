// lib/campaignBanner.js — homepage campaign banner (content managed by admins).
import { apiFetch } from "./api";

// How long the homepage may serve a cached banner before re-checking the
// backend. Bounds how quickly admin edits and schedule start/end times show.
export const BANNER_REVALIDATE_SECONDS = 60;

/**
 * The banner to show right now, or null (disabled, outside its schedule, or
 * the backend is unreachable — the homepage simply renders without it).
 * Server-side: cached and revalidated every BANNER_REVALIDATE_SECONDS.
 */
export async function getActiveCampaignBanner() {
  try {
    const data = await apiFetch("/campaign-banner/", {
      method: "GET",
      next: { revalidate: BANNER_REVALIDATE_SECONDS },
    });
    return data?.active ? data.banner : null;
  } catch {
    return null;
  }
}

/** Admin only: the full configuration, including schedule and status. */
export function getCampaignBannerConfig() {
  return apiFetch("/campaign-banner/manage/", { method: "GET" });
}

/** Admin only: save + publish. `formData` carries text fields and any new image files. */
export function updateCampaignBanner(formData) {
  return apiFetch("/campaign-banner/manage/", { method: "PUT", body: formData, isFormData: true });
}
