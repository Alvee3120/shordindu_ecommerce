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

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, value);
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** Admin/CCE: every review, all statuses, server-side filtered + paginated. */
export function listManagedReviews({
  page,
  search,
  status,
  rating,
  verified_purchase,
  ordering,
} = {}) {
  return apiFetch(
    `/reviews/manage/${buildQuery({ page, search, status, rating, verified_purchase, ordering })}`,
    { method: "GET" }
  );
}

export function createManagedReview(formData) {
  return apiFetch("/reviews/manage/", {
    method: "POST",
    body: formData,
    isFormData: true,
  });
}

export function updateManagedReview(id, body) {
  const isFormData = body instanceof FormData;
  return apiFetch(`/reviews/manage/${id}/`, {
    method: "PATCH",
    body,
    isFormData,
  });
}

export function deleteManagedReview(id) {
  return apiFetch(`/reviews/manage/${id}/`, { method: "DELETE" });
}

export function updateReviewStatus(id, status) {
  return apiFetch(`/reviews/manage/${id}/`, {
    method: "PATCH",
    body: { status },
  });
}
