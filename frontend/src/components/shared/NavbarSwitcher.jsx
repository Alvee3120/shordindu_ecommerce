"use client";

import { usePathname } from "next/navigation";
import HomeNavbar from "@/components/shared/HomeNavbar";
import Navbar from "@/components/shared/Navbar";
import { useSiteChrome } from "@/components/shared/useSiteChrome";

export default function NavbarSwitcher() {
  const pathname = usePathname();
  const { showNavbar } = useSiteChrome();
  if (!showNavbar) return null;
  return pathname === "/" ? <HomeNavbar /> : <Navbar />;
}
