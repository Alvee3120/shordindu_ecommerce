"use client";

import { useAuth } from "@/context/AuthContext";
import ProfileFields from "@/components/dashboard/ProfileFields";

export default function DashboardProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-neutral-900">My Profile</h1>
      <ProfileFields user={user} />
    </div>
  );
}
