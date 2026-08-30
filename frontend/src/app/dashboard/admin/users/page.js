"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FiTrash2 } from "react-icons/fi";
import { listUsers, updateUser, deleteUser } from "@/lib/users";
import { useAuth } from "@/context/AuthContext";

const roleStyles = {
  customer: "bg-neutral-100 text-neutral-600",
  cce: "bg-blue-50 text-blue-700",
  admin: "bg-(--primary)/10 text-(--primary)",
};

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const data = await listUsers({ page: p, role: roleFilter || undefined });
      setUsers(data.results);
      setCount(data.count);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, roleFilter]);

  const handleRoleChange = async (targetUser, role) => {
    setSavingId(targetUser.id);
    try {
      const updated = await updateUser(targetUser.id, { role });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      toast.success(`${updated.name || updated.email} is now ${updated.role === "cce" ? "CCE" : updated.role}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleActive = async (targetUser) => {
    setSavingId(targetUser.id);
    try {
      const updated = await updateUser(targetUser.id, { is_active: !targetUser.is_active });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      toast.success(updated.is_active ? "Account activated" : "Account deactivated");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (targetUser) => {
    if (!confirm(`Delete ${targetUser.name || targetUser.email}? This can't be undone.`)) return;
    setDeletingId(targetUser.id);
    try {
      await deleteUser(targetUser.id);
      toast.success("User deleted");
      setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
      setCount((c) => c - 1);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(count / 20));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-neutral-900">Users</h1>
        <select
          value={roleFilter}
          onChange={(e) => {
            setPage(1);
            setRoleFilter(e.target.value);
          }}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
        >
          <option value="">All roles</option>
          <option value="customer">Customer</option>
          <option value="cce">CCE</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {loading ? (
        <p className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
          Loading users...
        </p>
      ) : users.length === 0 ? (
        <p className="text-sm text-neutral-500">No users found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Phone</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Joined</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-5 py-3 font-medium text-neutral-900">
                      {u.name || "—"} {isSelf && <span className="text-xs text-neutral-400">(you)</span>}
                    </td>
                    <td className="px-5 py-3 text-neutral-600">{u.email}</td>
                    <td className="px-5 py-3 text-neutral-600">{u.phone || "—"}</td>
                    <td className="px-5 py-3">
                      <select
                        value={u.role}
                        disabled={isSelf || savingId === u.id}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                        className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold capitalize outline-none disabled:opacity-50 ${
                          roleStyles[u.role] || "bg-neutral-100 text-neutral-600"
                        }`}
                      >
                        <option value="customer">Customer</option>
                        <option value="cce">CCE</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(u)}
                        disabled={isSelf || savingId === u.id}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                          u.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                        }`}
                      >
                        {u.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-neutral-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(u)}
                        disabled={isSelf || deletingId === u.id}
                        className="inline-flex items-center gap-1.5 font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <FiTrash2 size={14} />
                        {deletingId === u.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-neutral-500">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
