// lib/attributes.js
import { apiFetch } from "./api";

export async function listAttributes() {
  const data = await apiFetch("/attributes/", { method: "GET" });
  return data.results;
}

export function createAttribute({ name }) {
  return apiFetch("/attributes/", { method: "POST", body: { name } });
}

export function updateAttribute(id, { name }) {
  return apiFetch(`/attributes/${id}/`, { method: "PATCH", body: { name } });
}

export function deleteAttribute(id) {
  return apiFetch(`/attributes/${id}/`, { method: "DELETE" });
}

export function createAttributeValue({ attribute, value, sort_order }) {
  return apiFetch("/attribute-values/", {
    method: "POST",
    body: { attribute, value, sort_order: sort_order ?? 0 },
  });
}

export function updateAttributeValue(id, { value, sort_order }) {
  return apiFetch(`/attribute-values/${id}/`, {
    method: "PATCH",
    body: { value, sort_order },
  });
}

export function deleteAttributeValue(id) {
  return apiFetch(`/attribute-values/${id}/`, { method: "DELETE" });
}
