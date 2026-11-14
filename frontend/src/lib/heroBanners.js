// Homepage hero banners (admin-managed, max 3) + carousel settings.
import { apiFetch } from "./api";

// How long the homepage may serve cached hero banners before re-checking the
// backend, so admin edits appear automatically without a redeploy.
export const HERO_REVALIDATE_SECONDS = 30;
export const DEFAULT_AUTOPLAY_DELAY_MS = 5000;

/** Active hero slides in display order (server-side filtered). */
export async function getActiveHeroBanners() {
  try {
    const data = await apiFetch("/hero-banners/", {
      method: "GET",
      next: { revalidate: HERO_REVALIDATE_SECONDS },
    });
    return {
      banners: data?.banners ?? [],
      autoplayDelayMs: data?.autoplay_delay_ms ?? DEFAULT_AUTOPLAY_DELAY_MS,
    };
  } catch {
    return { banners: [], autoplayDelayMs: DEFAULT_AUTOPLAY_DELAY_MS };
  }
}

/** Admin only: every banner, including inactive ones, in display order. */
export function getHeroBannerConfig() {
  return apiFetch("/hero-banners/manage/", { method: "GET" });
}

export function createHeroBanner(formData) {
  return apiFetch("/hero-banners/manage/", {
    method: "POST",
    body: formData,
    isFormData: true,
  });
}

export function updateHeroBanner(id, body) {
  const isFormData = body instanceof FormData;
  return apiFetch(`/hero-banners/manage/${id}/`, {
    method: "PATCH",
    body,
    isFormData,
  });
}

export function deleteHeroBanner(id) {
  return apiFetch(`/hero-banners/manage/${id}/`, { method: "DELETE" });
}

export function reorderHeroBanners(order) {
  return apiFetch("/hero-banners/manage/reorder/", {
    method: "POST",
    body: { order },
  });
}

export function getHeroBannerSettings() {
  return apiFetch("/hero-banners/manage/settings/", { method: "GET" });
}

export function updateHeroBannerSettings(payload) {
  return apiFetch("/hero-banners/manage/settings/", {
    method: "PATCH",
    body: payload,
  });
}
