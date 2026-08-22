// lib/reviews.js
import { apiFetch } from "./api";

export function listReviews({ page, product, status } = {}) {
  const params = new URLSearchParams();
  if (page) params.set("page", page);
  if (product) params.set("product", product);
  if (status) params.set("status", status);
  const query = params.toString();
  return apiFetch(`/reviews/${query ? `?${query}` : ""}`, { method: "GET" });
}

export function createReview({ product, rating, comment, image }) {
  if (image) {
    const form = new FormData();
    form.append("product", product);
    form.append("rating", rating);
    form.append("comment", comment ?? "");
    form.append("image", image);
    return apiFetch("/reviews/", { method: "POST", body: form, isFormData: true });
  }
  return apiFetch("/reviews/", {
    method: "POST",
    body: { product, rating, comment: comment ?? "" },
  });
}

export function deleteReview(id) {
  return apiFetch(`/reviews/${id}/`, { method: "DELETE" });
}

export function approveReview(id) {
  return apiFetch(`/reviews/${id}/approve/`, { method: "POST" });
}
