"use client";

import Link from "next/link";
import { FiLock } from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";
import ProfileFields from "@/components/dashboard/ProfileFields";
import { formatDate } from "@/lib/format";

function initialsFor(user) {
  const source = (user?.name || user?.email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function AdminProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        Loading…
      </div>
    );
  }

  const roleLabel = user.role === "cce" ? "CCE" : user.role;

  return (
    <div className="max-w-3xl pb-10">
      <h1 className="text-xl font-semibold text-neutral-900">My Profile</h1>
      <p className="mt-1 text-sm text-neutral-500">Manage your account details.</p>

      <div className="mt-6 flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-(--primary)/10 text-xl font-semibold text-(--primary)">
          {initialsFor(user)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-neutral-900">{user.name}</p>
          <p className="truncate text-sm text-neutral-500">{user.email}</p>
          <span className="mt-2 inline-block rounded-full bg-(--primary)/10 px-2.5 py-1 text-xs font-semibold text-(--primary) capitalize">
            {roleLabel}
          </span>
        </div>
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-neutral-700">Account details</h2>
      <ProfileFields user={user} />

      <h2 className="mt-8 mb-3 text-sm font-semibold text-neutral-700">Account information</h2>
      <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-neutral-500">Member since</span>
          <span className="text-sm font-medium text-neutral-900">{formatDate(user.created_at)}</span>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-neutral-500">Password</span>
          <span className="text-sm font-medium text-neutral-900">
            {user.force_password_change ? "Change required" : "Set"}
          </span>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-neutral-500">Security</span>
          <Link
            href="/dashboard/change-password"
            className="flex items-center gap-1.5 text-sm font-medium text-(--primary) hover:underline"
          >
            <FiLock size={14} />
            Change password
          </Link>
        </div>
      </div>
    </div>
  );
}
