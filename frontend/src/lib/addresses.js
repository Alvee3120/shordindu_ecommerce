// lib/addresses.js
import { apiFetch } from "./api";

export async function listAddresses() {
  const data = await apiFetch("/addresses/", { method: "GET" });
  return data.results;
}

export function createAddress({ name, phone, address, district, is_default }) {
  return apiFetch("/addresses/", {
    method: "POST",
    body: { name, phone, address, district, is_default },
  });
}

export function updateAddress(id, { name, phone, address, district, is_default }) {
  return apiFetch(`/addresses/${id}/`, {
    method: "PATCH",
    body: { name, phone, address, district, is_default },
  });
}

export function deleteAddress(id) {
  return apiFetch(`/addresses/${id}/`, { method: "DELETE" });
}
