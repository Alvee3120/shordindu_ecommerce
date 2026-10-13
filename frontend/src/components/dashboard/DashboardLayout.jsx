"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  FiUser,
  FiUserCheck,
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
  FiUsers,
  FiShoppingBag,
  FiBell,
  FiBarChart2,
  FiPlusCircle,
  FiTruck,
  FiExternalLink,
  FiImage,
} from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";
import { AnalyticsRangeProvider } from "@/components/admin/analytics/AnalyticsRangeContext";
import { useSiteChrome } from "@/components/shared/useSiteChrome";

// Change Password link every logged-in user gets, regardless of role
const changePasswordLink = { label: "Change Password", href: "/dashboard/change-password", icon: FiLock };

// role -> the role-specific links, inserted between "Profile" and "Change Password"
const roleLinks = {
  customer: [
    { label: "Orders", href: "/dashboard/customer/orders", icon: FiPackage },
    { label: "Addresses", href: "/dashboard/customer/addresses", icon: FiMapPin },
  ],
  cce: [
    { label: "Add Order", href: "/dashboard/cce/orders/new", icon: FiPlusCircle },
    { label: "Orders", href: "/dashboard/cce/orders", icon: FiPackage },
    { label: "Coupons", href: "/dashboard/cce/coupons", icon: FiTag },
    { label: "My Profile", href: "/dashboard/cce/profile", icon: FiUser },
  ],
  admin: [
    { label: "Orders", href: "/dashboard/admin/orders", icon: FiPackage },
    { label: "Sales Analytics", href: "/dashboard/admin/sales", icon: FiBarChart2 },
    { label: "Customers", href: "/dashboard/admin/customers", icon: FiUserCheck },
    { label: "My Orders", href: "/dashboard/admin/my-orders", icon: FiShoppingBag },
    { label: "Products", href: "/dashboard/admin/products", icon: FiBox },
    { label: "Categories", href: "/dashboard/admin/categories", icon: FiGrid },
    { label: "Attributes", href: "/dashboard/admin/attributes", icon: FiSliders },
    { label: "Product Addons", href: "/dashboard/admin/product-addons", icon: FiLink2 },
    { label: "Coupons", href: "/dashboard/admin/coupons", icon: FiTag },
    { label: "Delivery Charges", href: "/dashboard/admin/delivery-charges", icon: FiTruck },
    { label: "Campaign Banner", href: "/dashboard/admin/campaign-banner", icon: FiImage },
    { label: "Reviews", href: "/dashboard/admin/reviews", icon: FiStar },
    { label: "Stock Notifications", href: "/dashboard/admin/stock-notifications", icon: FiBell },
    { label: "Users", href: "/dashboard/admin/users", icon: FiUsers },
    { label: "My Profile", href: "/dashboard/admin/profile", icon: FiUser },
  ],
};

function getLinksForRole(role) {
  const middle = roleLinks[role] ?? roleLinks.customer;
  // Admin and CCE land on a sales Overview; customers get their profile.
  const firstLink =
    role === "admin" || role === "cce"
      ? { label: "Overview", href: `/dashboard/${role}`, icon: FiGrid }
      : { label: "Profile", href: `/dashboard/${role}`, icon: FiUser };
  // Overview/Profile first, role-specific links in the middle, Change Password last
  return [firstLink, ...middle, changePasswordLink];
}

const DashboardLayout = ({ children }) => {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { isStaffDashboard } = useSiteChrome();

  const role = user?.role ?? "customer";
  const roleLabel = role === "cce" ? "CCE" : role;
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
      <div className="mx-auto min-h-screen max-w-7xl px-4 py-16 text-center text-sm text-neutral-500">
        Loading...
      </div>
    );
  }

  const userInfo = (
    <div className="mb-4 flex items-center gap-3 lg:mb-6">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--primary)/10 text-(--primary)">
        <FiUser size={18} />
      </span>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate font-medium text-neutral-900">{user.name}</p>
          {role !== "customer" && (
            <span className="shrink-0 rounded-full bg-(--primary)/10 px-2 py-0.5 text-[11px] font-semibold text-(--primary) capitalize">
              {roleLabel}
            </span>
          )}
        </div>
        <p className="truncate text-sm text-neutral-500">{user.email}</p>
      </div>
    </div>
  );

  const logoutButton = (
    <button
      type="button"
      onClick={handleLogout}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium whitespace-nowrap text-red-600 hover:bg-red-50"
    >
      <FiLogOut size={16} />
      Logout
    </button>
  );

  const nav = (
        <nav
          className="-mx-4 flex flex-row gap-1 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
        >
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
          {/* Staff sidebars pin Logout outside the scrolling list instead. */}
          {!isStaffDashboard && logoutButton}
        </nav>
  );

  // Admin / CCE: full-screen workspace, no site navbar or footer. On desktop
  // the sidebar is fixed to the left: the links scroll on their own
  // (data-lenis-prevent keeps the smooth-scroll wrapper off them) while
  // Logout stays pinned at the bottom. On mobile, Logout sits in the header
  // row so it's never scrolled out of the horizontal link strip.
  if (isStaffDashboard) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <aside className="w-full border-b border-neutral-200 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-b-0">
          <div data-lenis-prevent className="px-4 py-4 sm:px-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-4 lg:py-5">
            <div className="mb-4 flex items-center justify-between gap-3 lg:mb-6">
              <Link href={`/dashboard/${role}`} aria-label="Dashboard home">
                <Image src="/assets/logo/logolight.png" alt="Shordindu" width={56} height={56} priority />
              </Link>
              <div className="flex items-center gap-3">
                <Link
                  href="/"
                  className="flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-(--primary)"
                >
                  View store
                  <FiExternalLink size={12} />
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 lg:hidden"
                >
                  <FiLogOut size={14} />
                  Logout
                </button>
              </div>
            </div>
            {userInfo}
            {nav}
          </div>
          <div className="hidden shrink-0 border-t border-neutral-200 px-4 py-3 lg:block">{logoutButton}</div>
        </aside>

        <AnalyticsRangeProvider>
          <div className="min-w-0 px-4 py-6 sm:px-6 lg:py-8 lg:pr-8 lg:pl-72">{children}</div>
        </AnalyticsRangeProvider>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10 lg:flex-row">
      <aside className="w-full shrink-0 border-b border-neutral-200 pb-4 lg:w-64 lg:border-r lg:border-b-0 lg:border-r-gray-200 lg:pr-4 lg:pb-0">
        {userInfo}
        {nav}
      </aside>

      <AnalyticsRangeProvider>
        <div className="min-w-0 flex-1">{children}</div>
      </AnalyticsRangeProvider>
    </div>
  );
};

export default DashboardLayout;
