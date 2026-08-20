"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  FiUser,
  FiLock,
  FiLogOut,
  FiMapPin,
  FiPackage,
  FiTag,
  FiGrid,
  FiBox,
  FiStar,
  FiSliders,
  FiLink2,
} from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";

// Change Password link every logged-in user gets, regardless of role
const changePasswordLink = { label: "Change Password", href: "/dashboard/change-password", icon: FiLock };

// role -> the role-specific links, inserted between "Profile" and "Change Password"
const roleLinks = {
  customer: [
    { label: "Orders", href: "/dashboard/customer/orders", icon: FiPackage },
    { label: "Addresses", href: "/dashboard/customer/addresses", icon: FiMapPin },
  ],
  staff: [
    { label: "Orders", href: "/dashboard/staff/orders", icon: FiPackage },
    { label: "Products", href: "/dashboard/staff/products", icon: FiBox },
    { label: "Categories", href: "/dashboard/staff/categories", icon: FiGrid },
    { label: "Coupons", href: "/dashboard/staff/coupons", icon: FiTag },
    { label: "Reviews", href: "/dashboard/staff/reviews", icon: FiStar },
  ],
  admin: [
    { label: "Orders", href: "/dashboard/admin/orders", icon: FiPackage },
    { label: "Products", href: "/dashboard/admin/products", icon: FiBox },
    { label: "Categories", href: "/dashboard/admin/categories", icon: FiGrid },
    { label: "Attributes", href: "/dashboard/admin/attributes", icon: FiSliders },
    { label: "Product Addons", href: "/dashboard/admin/product-addons", icon: FiLink2 },
    { label: "Coupons", href: "/dashboard/admin/coupons", icon: FiTag },
    { label: "Reviews", href: "/dashboard/admin/reviews", icon: FiStar },
  ],
};

function getLinksForRole(role) {
  const middle = roleLinks[role] ?? roleLinks.customer;
  const profileLink = { label: "Profile", href: `/dashboard/${role}`, icon: FiUser };
  // Profile first, role-specific links in the middle, Change Password last
  return [profileLink, ...middle, changePasswordLink];
}

const DashboardLayout = ({ children }) => {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const role = user?.role ?? "customer";
  const links = getLinksForRole(role);

  useEffect(() => {
    if (!loading && !user) router.replace("/auth/login");
  }, [loading, user, router]);

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-neutral-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl  flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-64 border-r border-r-gray-200 pr-4">
        <div className="mb-6">
          <p className="text-sm text-neutral-500">Signed in as</p>
          <p className="truncate font-medium text-neutral-900">{user.name}</p>
          <p className="truncate text-sm text-neutral-500">{user.email}</p>
          {role !== "customer" && (
            <span className="mt-2 inline-block rounded-full bg-(--primary)/10 px-2.5 py-1 text-xs font-semibold text-(--primary) capitalize">
              {role}
            </span>
          )}
        </div>

        <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {links.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-(--primary)/10 text-(--primary)"
                    : "text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
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