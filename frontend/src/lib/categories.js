// lib/categories.js
import { apiFetch } from "./api";

export function getCategories() {
  return apiFetch("/categories/", { method: "GET" });
}

export function getCategory(id) {
  return apiFetch(`/categories/${id}/`, { method: "GET" });
}

function buildCategoryPayload({ name, parent, description, image }) {
  if (!(image instanceof File)) {
    return { body: { name, parent: parent || null, description } };
  }
  const form = new FormData();
  form.append("name", name);
  if (parent) form.append("parent", parent);
  form.append("description", description || "");
  form.append("image", image);
  return { body: form, isFormData: true };
}

export function createCategory({ name, parent, description, image }) {
  return apiFetch("/categories/", {
    method: "POST",
    ...buildCategoryPayload({ name, parent, description, image }),
  });
}

export function updateCategory(id, { name, parent, description, image }) {
  return apiFetch(`/categories/${id}/`, {
    method: "PATCH",
    ...buildCategoryPayload({ name, parent, description, image }),
  });
}

export function deleteCategory(id) {
  return apiFetch(`/categories/${id}/`, { method: "DELETE" });
}

/** Groups a flat category list into top-level categories with a `children` array. */
export function buildCategoryTree(categoryList) {
  const byParent = new Map();
  categoryList.forEach((cat) => {
    const parentId = cat.parent ?? null;
    if (!byParent.has(parentId)) byParent.set(parentId, []);
    byParent.get(parentId).push(cat);
  });
  const parents = byParent.get(null) || [];
  return parents.map((parent) => ({
    ...parent,
    children: byParent.get(parent.id) || [],
  }));
}
