"use client";

import { useEffect, useState } from "react";
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
  FiShoppingCart,
  FiBell,
  FiBarChart2,
  FiPlusCircle,
  FiTruck,
  FiExternalLink,
  FiImage,
  FiPercent,
  FiChevronLeft,
  FiChevronRight,
  FiSettings,
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
    { label: "Old Carts", href: "/dashboard/cce/old-carts", icon: FiShoppingCart },
    { label: "Reviews", href: "/dashboard/cce/reviews", icon: FiStar },
    { label: "Coupons", href: "/dashboard/cce/coupons", icon: FiTag },
    { label: "My Profile", href: "/dashboard/cce/profile", icon: FiUser },
  ],
  admin: [
    { label: "Orders", href: "/dashboard/admin/orders", icon: FiPackage },
    { label: "Sales Analytics", href: "/dashboard/admin/sales", icon: FiBarChart2 },
    { label: "Customers", href: "/dashboard/admin/customers", icon: FiUserCheck },
    { label: "Old Carts", href: "/dashboard/admin/old-carts", icon: FiShoppingCart },
    { label: "My Orders", href: "/dashboard/admin/my-orders", icon: FiShoppingBag },
    { label: "Products", href: "/dashboard/admin/products", icon: FiBox },
    { label: "Categories", href: "/dashboard/admin/categories", icon: FiGrid },
    { label: "Attributes", href: "/dashboard/admin/attributes", icon: FiSliders },
    { label: "Product Addons", href: "/dashboard/admin/product-addons", icon: FiLink2 },
    { label: "Discounts", href: "/dashboard/admin/discounts", icon: FiPercent },
    { label: "Coupons", href: "/dashboard/admin/coupons", icon: FiTag },
    { label: "Delivery Charges", href: "/dashboard/admin/delivery-charges", icon: FiTruck },
    { label: "Campaign Banner", href: "/dashboard/admin/campaign-banner", icon: FiImage },
    { label: "Hero Banners", href: "/dashboard/admin/banners", icon: FiImage },
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

  const [mobileOpen, setMobileOpen] = useState(false);
  const [tooltip, setTooltip] = useState(null);

  const hideTooltip = () => setTooltip(null);
  const closeMobileSidebar = () => {
    setMobileOpen(false);
    setTooltip(null);
  };
  const showTooltip = (event, label) => {
    if (mobileOpen) return;
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({ label, top: rect.top + rect.height / 2 });
  };
  const tooltipHandlers = (label) => ({
    onMouseEnter: (event) => showTooltip(event, label),
    onMouseLeave: hideTooltip,
    onFocus: (event) => showTooltip(event, label),
    onBlur: hideTooltip,
  });
  const mobileActionClass = `flex items-center rounded-lg text-sm font-medium text-neutral-600 transition-colors active:bg-neutral-200 ${
    mobileOpen
      ? "w-full gap-2 px-3 py-2.5 text-left hover:bg-neutral-100"
      : "mx-auto h-10 w-10 justify-center hover:bg-neutral-100"
  }`;

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

  // Admin / CCE: full-screen workspace, no site navbar or footer.
  // Desktop (lg+): the original fixed 256px sidebar with icons + labels.
  // Tablet/mobile: a fixed 64px icon rail that can expand into a 256px
  // overlay. The mobile rail stays visible while scrolling; its nav scrolls
  // inside the rail and the profile/avatar sits at the bottom.
  if (isStaffDashboard) {
    const mobileLinks = links.filter((link) => link.href !== changePasswordLink.href);

    return (
      <div className="min-h-screen bg-white">
        {mobileOpen && (
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={closeMobileSidebar}
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          />
        )}

        <aside
          id="dashboard-sidebar"
          className={`fixed top-2 bottom-2 left-2 z-40 flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-[width] duration-300 ease-in-out lg:inset-y-0 lg:left-0 lg:w-64 lg:rounded-none lg:border-y-0 lg:border-l-0 lg:shadow-none ${
            mobileOpen ? "w-64 shadow-xl" : "w-16"
          }`}
        >
          {/* Desktop sidebar — unchanged structure and styling. */}
          <div className="hidden min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:block">
            <div className="mb-6 flex items-center justify-between gap-3">
              <Link href={`/dashboard/${role}`} aria-label="Dashboard home">
                <Image src="/assets/logo/logolight.png" alt="Shordindu" width={56} height={56} priority />
              </Link>
              <Link
                href="/"
                className="flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-(--primary)"
              >
                View store
                <FiExternalLink size={12} />
              </Link>
            </div>
            {userInfo}
            {nav}
          </div>
          <div className="hidden shrink-0 border-t border-neutral-200 px-4 py-3 lg:block">{logoutButton}</div>

          {/* Mobile header: logo + collapse/expand control. */}
          <div
            className={`flex shrink-0 items-center gap-2 border-b border-neutral-100 px-2 py-3 lg:hidden ${
              mobileOpen ? "justify-between" : "flex-col justify-center"
            }`}
          >
            <Link href={`/dashboard/${role}`} aria-label="Dashboard home" onClick={closeMobileSidebar}>
              <Image
                src="/assets/logo/logolight.png"
                alt="Shordindu"
                width={mobileOpen ? 34 : 28}
                height={mobileOpen ? 34 : 28}
                priority
              />
            </Link>
            <button
              type="button"
              onClick={() => {
                hideTooltip();
                setMobileOpen((open) => !open);
              }}
              aria-label={mobileOpen ? "Collapse sidebar" : "Expand sidebar"}
              aria-expanded={mobileOpen}
              aria-controls="dashboard-sidebar"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 active:bg-neutral-200"
            >
              {mobileOpen ? <FiChevronLeft size={18} /> : <FiChevronRight size={18} />}
            </button>
          </div>

          {/* Mobile navigation: icon-only by default, labels when expanded. */}
          <div
            onScroll={hideTooltip}
            className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 py-2 lg:hidden"
          >
            <nav className="flex flex-col gap-1.5" aria-label="Dashboard navigation">
              {mobileLinks.map(({ label, href, icon: Icon }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-label={label}
                    aria-current={isActive ? "page" : undefined}
                    onClick={closeMobileSidebar}
                    {...(!mobileOpen ? tooltipHandlers(label) : {})}
                    className={`flex items-center rounded-lg text-sm font-medium transition-colors active:bg-neutral-200 ${
                      mobileOpen ? "gap-2 px-3 py-2.5" : "mx-auto h-11 w-11 justify-center"
                    } ${
                      isActive
                        ? "bg-(--primary)/10 text-(--primary)"
                        : "text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className={`${mobileOpen ? "inline" : "hidden"} whitespace-nowrap`}>
                      {label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Mobile bottom: secondary actions + profile/avatar. */}
          <div className="shrink-0 border-t border-neutral-200 p-2 lg:hidden">
            <Link
              href="/"
              aria-label="View store"
              onClick={closeMobileSidebar}
              {...(!mobileOpen ? tooltipHandlers("View store") : {})}
              className={`${mobileActionClass} text-neutral-600 hover:bg-neutral-100`}
            >
              <FiExternalLink size={18} className="shrink-0" />
              {mobileOpen && <span className="whitespace-nowrap">View store</span>}
            </Link>
            <Link
              href={changePasswordLink.href}
              aria-label={changePasswordLink.label}
              onClick={closeMobileSidebar}
              {...(!mobileOpen ? tooltipHandlers(changePasswordLink.label) : {})}
              className={`${mobileActionClass} text-neutral-600 hover:bg-neutral-100`}
            >
              <FiSettings size={18} className="shrink-0" />
              {mobileOpen && <span className="whitespace-nowrap">{changePasswordLink.label}</span>}
            </Link>
            <button
              type="button"
              onClick={() => {
                hideTooltip();
                handleLogout();
              }}
              aria-label="Logout"
              {...(!mobileOpen ? tooltipHandlers("Logout") : {})}
              className={`${mobileActionClass} text-red-600 hover:bg-red-50`}
            >
              <FiLogOut size={18} className="shrink-0" />
              {mobileOpen && <span className="whitespace-nowrap">Logout</span>}
            </button>

            <Link
              href={`/dashboard/${role}/profile`}
              aria-label="My Profile"
              onClick={closeMobileSidebar}
              {...(!mobileOpen ? tooltipHandlers("My Profile") : {})}
              className={`mt-1 flex items-center rounded-lg p-1.5 transition-colors hover:bg-neutral-100 ${
                mobileOpen ? "gap-3" : "mx-auto justify-center"
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--primary)/10 text-(--primary)">
                <FiUser size={16} />
              </span>
              {mobileOpen && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">{user.name}</p>
                  <p className="truncate text-xs text-neutral-500">{user.email}</p>
                </div>
              )}
            </Link>
          </div>
        </aside>

        {tooltip && (
          <span
            role="tooltip"
            className="pointer-events-none fixed left-20 z-[60] max-w-[70vw] -translate-y-1/2 truncate rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg lg:hidden"
            style={{ top: tooltip.top }}
          >
            {tooltip.label}
          </span>
        )}

        <AnalyticsRangeProvider>
          <div className="min-w-0 py-6 pl-20 pr-4 sm:pr-6 lg:py-8 lg:pl-72 lg:pr-8">
            {children}
          </div>
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
