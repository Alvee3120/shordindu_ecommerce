// lib/announcementBar.js — site-wide announcement strip (managed by admins).
import { apiFetch } from "./api";

/**
 * The announcement to show right now (enabled and non-empty), or null.
 * Always fresh, so an admin's save shows on the next page load.
 */
export async function getActiveAnnouncement() {
  try {
    const data = await apiFetch("/announcement-bar/", {
      method: "GET",
      cache: "no-store",
    });
    return data?.active ? data.announcement : null;
  } catch {
    return null;
  }
}

/** Admin only: the full configuration. */
export function getAnnouncementConfig() {
  return apiFetch("/announcement-bar/manage/", { method: "GET" });
}

/** Admin only: save + publish. */
export function updateAnnouncement(payload) {
  return apiFetch("/announcement-bar/manage/", { method: "PUT", body: payload });
}
