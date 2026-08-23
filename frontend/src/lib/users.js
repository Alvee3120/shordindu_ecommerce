// lib/users.js
import { apiFetch } from "./api";

export function listUsers({ page, role, is_active } = {}) {
  const params = new URLSearchParams();
  if (page) params.set("page", page);
  if (role) params.set("role", role);
  if (is_active !== undefined && is_active !== "") params.set("is_active", is_active);
  const query = params.toString();
  return apiFetch(`/users/${query ? `?${query}` : ""}`, { method: "GET" });
}

export function updateUser(id, data) {
  return apiFetch(`/users/${id}/`, { method: "PATCH", body: data });
}

export function deleteUser(id) {
  return apiFetch(`/users/${id}/`, { method: "DELETE" });
}
