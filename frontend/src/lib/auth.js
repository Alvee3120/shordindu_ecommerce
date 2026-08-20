// lib/auth.js
import { apiFetch } from "./api";

export function signIn({ email, password }) {
  return apiFetch("/auth/signin/", {
    method: "POST",
    body: { email, password },
  });
}

export function signUp({ email, name, phone, password }) {
  return apiFetch("/auth/signup/", {
    method: "POST",
    body: { email, name, phone, password },
  });
}

export function signOut() {
  return apiFetch("/auth/logout/", { method: "POST" });
}

export function getMe() {
  return apiFetch("/auth/me/", { method: "GET" });
}

export function updateProfile({ name, phone }) {
  return apiFetch("/auth/me/", {
    method: "PATCH",
    body: { name, phone },
  });
}

export function changePassword({ old_password, new_password }) {
  return apiFetch("/auth/change-password/", {
    method: "POST",
    body: { old_password, new_password },
  });
}