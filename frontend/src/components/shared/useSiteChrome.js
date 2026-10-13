"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const STAFF_ROLES = ["admin", "cce"];

/**
 * Which storefront chrome a page gets. Layout only — access control is done
 * by the backend and the dashboard's own auth checks.
 *
 * - Admin / CCE dashboard: no navbar and no footer (full-screen workspace
 *   with a fixed left sidebar).
 * - Customer dashboard: navbar, no footer.
 * - Everything else: navbar + footer.
 *
 * Shared dashboard pages (e.g. /dashboard/change-password) follow the
 * signed-in user's role.
 */
export function useSiteChrome() {
  const pathname = usePathname() || "";
  const { user } = useAuth();

  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isStaffDashboard =
    isDashboard &&
    (pathname.startsWith("/dashboard/admin") ||
      pathname.startsWith("/dashboard/cce") ||
      STAFF_ROLES.includes(user?.role));

  return {
    isDashboard,
    isStaffDashboard,
    showNavbar: !isStaffDashboard,
    showFooter: !isDashboard,
  };
}
