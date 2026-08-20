// lib/reviews.js
import { apiFetch } from "./api";

export function listReviews({ page } = {}) {
  const params = new URLSearchParams();
  if (page) params.set("page", page);
  const query = params.toString();
  return apiFetch(`/reviews/${query ? `?${query}` : ""}`, { method: "GET" });
}

export function deleteReview(id) {
  return apiFetch(`/reviews/${id}/`, { method: "DELETE" });
}
