"use client";

import { useAuth } from "@/context/AuthContext";

const fields = [
  { label: "Full Name", key: "name" },
  { label: "Email", key: "email" },
  { label: "Phone", key: "phone" },
  { label: "Role", key: "role" },
];

export default function DashboardProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-neutral-900">My Profile</h1>
      <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
        {fields.map(({ label, key }) => (
          <div
            key={key}
            className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-sm text-neutral-500">{label}</span>
            <span className="text-sm font-medium text-neutral-900 capitalize">
              {user[key] || "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
