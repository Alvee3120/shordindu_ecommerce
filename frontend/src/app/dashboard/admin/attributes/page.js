"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FiPlus, FiTrash2, FiChevronDown, FiChevronUp } from "react-icons/fi";
import {
  listAttributes,
  createAttribute,
  deleteAttribute,
  createAttributeValue,
  deleteAttributeValue,
} from "@/lib/attributes";

export default function AdminAttributesPage() {
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const [newAttrName, setNewAttrName] = useState("");
  const [creatingAttr, setCreatingAttr] = useState(false);

  const [valueDrafts, setValueDrafts] = useState({}); // { [attrId]: "value text" }
  const [savingValueFor, setSavingValueFor] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listAttributes();
      setAttributes(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateAttribute = async (e) => {
    e.preventDefault();
    if (!newAttrName.trim()) return;
    setCreatingAttr(true);
    try {
      await createAttribute({ name: newAttrName.trim() });
      setNewAttrName("");
      toast.success("Attribute created");
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreatingAttr(false);
    }
  };

  const handleDeleteAttribute = async (id) => {
    if (!confirm("Delete this attribute and all its values?")) return;
    setDeletingId(id);
    try {
      await deleteAttribute(id);
      toast.success("Attribute deleted");
      setAttributes((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddValue = async (attrId) => {
    const value = (valueDrafts[attrId] || "").trim();
    if (!value) return;
    setSavingValueFor(attrId);
    try {
      await createAttributeValue({ attribute: attrId, value });
      setValueDrafts((prev) => ({ ...prev, [attrId]: "" }));
      toast.success("Value added");
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingValueFor(null);
    }
  };

  const handleDeleteValue = async (id) => {
    setDeletingId(id);
    try {
      await deleteAttributeValue(id);
      toast.success("Value deleted");
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-neutral-900">Attributes</h1>

      <form
        onSubmit={handleCreateAttribute}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-5"
      >
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">
            New Attribute Name
          </label>
          <input
            type="text"
            value={newAttrName}
            onChange={(e) => setNewAttrName(e.target.value)}
            placeholder="e.g. Size, Color"
            className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
          />
        </div>
        <button
          type="submit"
          disabled={creatingAttr}
          className="flex items-center gap-1.5 rounded-lg bg-(--primary) px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiPlus size={16} />
          Add Attribute
        </button>
      </form>

      {loading ? (
        <p className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
          Loading attributes...
        </p>
      ) : attributes.length === 0 ? (
        <p className="text-sm text-neutral-500">No attributes yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {attributes.map((attr) => {
            const isOpen = expandedId === attr.id;
            return (
              <div key={attr.id} className="rounded-xl border border-neutral-200 bg-white">
                <div className="flex items-center justify-between px-5 py-3.5">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : attr.id)}
                    className="flex items-center gap-2 font-medium text-neutral-900"
                  >
                    {isOpen ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                    {attr.name}
                    <span className="text-xs font-normal text-neutral-400">
                      ({attr.values.length} values)
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAttribute(attr.id)}
                    disabled={deletingId === attr.id}
                    className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    <FiTrash2 size={14} />
                    Delete
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-neutral-100 px-5 py-4">
                    <div className="mb-3 flex flex-wrap gap-2">
                      {attr.values.length === 0 && (
                        <p className="text-sm text-neutral-400">No values yet.</p>
                      )}
                      {attr.values.map((v) => (
                        <span
                          key={v.id}
                          className="flex items-center gap-1.5 rounded-full bg-neutral-100 py-1 pl-3 pr-1.5 text-sm text-neutral-700"
                        >
                          {v.value}
                          <button
                            type="button"
                            onClick={() => handleDeleteValue(v.id)}
                            disabled={deletingId === v.id}
                            className="flex items-center justify-center rounded-full p-1 text-neutral-400 hover:bg-neutral-200 hover:text-red-600"
                            aria-label={`Remove ${v.value}`}
                          >
                            <FiTrash2 size={11} />
                          </button>
                        </span>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={valueDrafts[attr.id] || ""}
                        onChange={(e) =>
                          setValueDrafts((prev) => ({ ...prev, [attr.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddValue(attr.id);
                          }
                        }}
                        placeholder="Add a value (e.g. Small, Red)"
                        className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddValue(attr.id)}
                        disabled={savingValueFor === attr.id}
                        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
