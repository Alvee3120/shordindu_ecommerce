import { apiFetch } from "./api";

export function listStockNotifications({ page } = {}) {
  const params = new URLSearchParams();
  if (page) params.set("page", page);
  const query = params.toString();
  return apiFetch(`/stock-notifications/${query ? `?${query}` : ""}`, { method: "GET" });
}

export function deleteStockNotification(id) {
  return apiFetch(`/stock-notifications/${id}/`, { method: "DELETE" });
}

export function createStockNotification(payload) {
  return apiFetch("/stock-notifications/", { method: "POST", body: payload });
}
