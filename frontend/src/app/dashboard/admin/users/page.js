"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FiEdit2, FiKey, FiPlus, FiSearch, FiTrash2 } from "react-icons/fi";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import InitialsAvatar from "@/components/admin/InitialsAvatar";
import ResetPasswordModal from "@/components/admin/ResetPasswordModal";
import UserFormModal from "@/components/admin/UserFormModal";
import { useAuth } from "@/context/AuthContext";
import { deleteUser, listUsers, updateUser } from "@/lib/users";

const roleStyles = {
  customer: "bg-neutral-100 text-neutral-600",
  cce: "bg-blue-50 text-blue-700",
  admin: "bg-(--primary)/10 text-(--primary)",
};

const roleLabels = {
  customer: "Customer",
  cce: "CCE",
  admin: "Admin",
};

const createdViaLabels = {
  admin: "Admin",
  checkout: "Checkout",
  self: "Self signup",
};

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [creating, setCreating] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resettingUser, setResettingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);

  const isAdmin = currentUser?.role === "admin";

  const load = async (p = page) => {
    setLoading(true);
    try {
      const data = await listUsers({
        page: p,
        role: roleFilter || undefined,
        is_active: activeFilter,
        search: search || undefined,
      });
      setUsers(data.results);
      setCount(data.count);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, roleFilter, activeFilter, search, isAdmin]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const handleRoleChange = async (targetUser, role) => {
    setSavingId(targetUser.id);
    try {
      const updated = await updateUser(targetUser.id, { role });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      toast.success(`${updated.name || updated.email || updated.phone} is now ${roleLabels[updated.role] || updated.role}`);
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

  const handleDelete = async () => {
    if (!deletingUser) return;
    setDeletingId(deletingUser.id);
    try {
      await deleteUser(deletingUser.id);
      toast.success("User deleted");
      setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id));
      setCount((c) => Math.max(0, c - 1));
      setDeletingUser(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const matchesActiveFilters = (targetUser) => {
    if (roleFilter && targetUser.role !== roleFilter) return false;
    if (activeFilter !== "" && String(targetUser.is_active) !== activeFilter) return false;
    if (search) {
      const haystack = [targetUser.name, targetUser.phone, targetUser.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search.toLowerCase())) return false;
    }
    return true;
  };

  const handleCreated = (created) => {
    if (page === 1 && matchesActiveFilters(created)) {
      setUsers((prev) => [created, ...prev]);
      setCount((c) => c + 1);
      return;
    }
    if (page === 1) {
      load(1);
    } else {
      setPage(1);
    }
  };

  const handleUpdated = (updated) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  const totalPages = Math.max(1, Math.ceil(count / 20));

  if (currentUser && !isAdmin) {
    return (
      <p className="text-sm text-neutral-500">Only administrators can manage users.</p>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Users</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Create and manage customer, CCE and admin accounts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-56">
            <FiSearch
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search name, phone, email..."
              aria-label="Search users"
              className="w-full rounded-lg border border-neutral-300 py-2 pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(event) => {
              setPage(1);
              setRoleFilter(event.target.value);
            }}
            aria-label="Filter by role"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
          >
            <option value="">All roles</option>
            <option value="customer">Customer</option>
            <option value="cce">CCE</option>
            <option value="admin">Admin</option>
          </select>
          <select
            value={activeFilter}
            onChange={(event) => {
              setPage(1);
              setActiveFilter(event.target.value);
            }}
            aria-label="Filter by status"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
          >
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-lg bg-(--primary) px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90"
          >
            <FiPlus size={16} />
            Create User
          </button>
        </div>
      </div>

      <div className={`overflow-x-auto rounded-xl border border-neutral-200 bg-white ${loading ? "opacity-60" : ""}`}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 whitespace-nowrap text-neutral-500">
              <th className="px-5 py-3 font-medium">Avatar</th>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Phone</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Created Via</th>
              <th className="px-5 py-3 font-medium">Created Date</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-6 text-center text-neutral-500">
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-6 text-center text-neutral-500">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className="border-b border-neutral-100 whitespace-nowrap last:border-0">
                    <td className="px-5 py-3">
                      <InitialsAvatar name={u.name} email={u.email} phone={u.phone} id={u.id} />
                    </td>
                    <td className="px-5 py-3 font-medium text-neutral-900">
                      {u.name || "—"}{" "}
                      {isSelf && <span className="text-xs text-neutral-400">(you)</span>}
                    </td>
                    <td className="px-5 py-3 text-neutral-600">{u.phone || "—"}</td>
                    <td className="px-5 py-3 text-neutral-600">{u.email || "—"}</td>
                    <td className="px-5 py-3">
                      <select
                        value={u.role}
                        disabled={isSelf || savingId === u.id}
                        onChange={(event) => handleRoleChange(u, event.target.value)}
                        aria-label={`Change role for ${u.name || u.phone || u.email}`}
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
                    <td className="px-5 py-3">
                      <span className="block text-neutral-600">
                        {createdViaLabels[u.created_via] || "—"}
                      </span>
                      {u.created_by_name && (
                        <span className="block text-xs text-neutral-400">{u.created_by_name}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-neutral-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-4">
                        <button
                          type="button"
                          onClick={() => setEditingUser(u)}
                          className="flex items-center gap-1.5 font-medium text-neutral-600 hover:text-(--primary)"
                        >
                          <FiEdit2 size={14} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setResettingUser(u)}
                          disabled={isSelf}
                          className="flex items-center gap-1.5 font-medium text-neutral-600 hover:text-(--primary) disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <FiKey size={14} />
                          Reset password
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingUser(u)}
                          disabled={isSelf}
                          className="flex items-center gap-1.5 font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <FiTrash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

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

      {creating && (
        <UserFormModal
          mode="create"
          onClose={() => setCreating(false)}
          onSaved={handleCreated}
        />
      )}

      {editingUser && (
        <UserFormModal
          mode="edit"
          user={editingUser}
          isSelf={editingUser.id === currentUser?.id}
          onClose={() => setEditingUser(null)}
          onSaved={handleUpdated}
        />
      )}

      {resettingUser && (
        <ResetPasswordModal
          user={resettingUser}
          onClose={() => setResettingUser(null)}
        />
      )}

      {deletingUser && (
        <ConfirmDialog
          title="Delete user"
          message={`Delete ${deletingUser.name || deletingUser.email || deletingUser.phone}? Their addresses and reviews will be removed and this can't be undone.`}
          confirmLabel="Delete user"
          loading={deletingId === deletingUser.id}
          onCancel={() => setDeletingUser(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
