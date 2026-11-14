// lib/users.js
import { apiFetch } from "./api";

export function listUsers({ page, role, is_active, search } = {}) {
  const params = new URLSearchParams();
  if (page) params.set("page", page);
  if (role) params.set("role", role);
  if (is_active !== undefined && is_active !== "") params.set("is_active", is_active);
  if (search) params.set("search", search);
  const query = params.toString();
  return apiFetch(`/users/${query ? `?${query}` : ""}`, { method: "GET" });
}

export function createUser(data) {
  return apiFetch("/users/", { method: "POST", body: data });
}

export function updateUser(id, data) {
  return apiFetch(`/users/${id}/`, { method: "PATCH", body: data });
}

export function resetUserPassword(id, data) {
  return apiFetch(`/users/${id}/reset-password/`, { method: "POST", body: data });
}

export function deleteUser(id) {
  return apiFetch(`/users/${id}/`, { method: "DELETE" });
}

/** CCE/admin: search existing customers by name, phone or email (min 2 chars). */
export function lookupCustomers(search) {
  return apiFetch(`/customer-lookup/?search=${encodeURIComponent(search)}`, { method: "GET" });
}
