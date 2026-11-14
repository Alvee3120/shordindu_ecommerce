"use client";

import { useState } from "react";
import { FiEdit2, FiCheck, FiX } from "react-icons/fi";
import { toast } from "sonner";
import { updateProfile } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";

const editableKeys = ["name", "phone"];

const fields = [
  { label: "Full Name", key: "name" },
  { label: "Email", key: "email" },
  { label: "Phone", key: "phone" },
  { label: "Role", key: "role" },
];

export default function ProfileFields({ user }) {
  const { refetch } = useAuth();
  const [editingKey, setEditingKey] = useState(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = (key) => {
    setEditingKey(key);
    setValue(user[key] || "");
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setValue("");
  };

  const saveEdit = async (key) => {
    if (!value.trim()) {
      toast.error("This field can't be empty");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ [key]: value.trim() });
      await refetch();
      toast.success("Profile updated");
      setEditingKey(null);
    } catch (err) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
      {fields.map(({ label, key }) => {
        const isEditable = editableKeys.includes(key);
        const isEditing = editingKey === key;

        return (
          <div
            key={key}
            className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-sm text-neutral-500">{label}</span>

            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  disabled={saving}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-(--primary)"
                />
                <button
                  type="button"
                  onClick={() => saveEdit(key)}
                  disabled={saving}
                  aria-label="Save"
                  className="flex items-center justify-center rounded-md p-1.5 text-(--primary) hover:bg-(--primary)/10 disabled:opacity-50"
                >
                  <FiCheck size={16} />
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  aria-label="Cancel"
                  className="flex items-center justify-center rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 disabled:opacity-50"
                >
                  <FiX size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-neutral-900 capitalize">
                  {key === "role" && user[key] === "cce" ? "CCE" : user[key] || "—"}
                </span>
                {isEditable && (
                  <button
                    type="button"
                    onClick={() => startEdit(key)}
                    aria-label={`Edit ${label}`}
                    className="flex items-center justify-center rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-(--primary)"
                  >
                    <FiEdit2 size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
