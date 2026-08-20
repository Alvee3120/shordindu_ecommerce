"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiUser, FiLock, FiLogOut } from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";

const links = [
  { label: "Profile", href: "/dashboard", icon: FiUser },
  { label: "Change Password", href: "/dashboard/change-password", icon: FiLock },
];

const DashboardLayout = ({ children }) => {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/auth/login");
  }, [loading, user, router]);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-neutral-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-64">
        <div className="mb-6">
          <p className="text-sm text-neutral-500">Signed in as</p>
          <p className="truncate font-medium text-neutral-900">{user.name}</p>
          <p className="truncate text-sm text-neutral-500">{user.email}</p>
        </div>

        <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {links.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium whitespace-nowrap text-neutral-700 hover:bg-neutral-100"
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium whitespace-nowrap text-red-600 hover:bg-red-50"
          >
            <FiLogOut size={16} />
            Logout
          </button>
        </nav>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
};

export default DashboardLayout;
