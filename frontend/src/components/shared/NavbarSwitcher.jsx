"use client";

import { usePathname } from "next/navigation";
import HomeNavbar from "@/components/shared/HomeNavbar";
import Navbar from "@/components/shared/Navbar";

export default function NavbarSwitcher() {
  const pathname = usePathname();
  return pathname === "/" ? <HomeNavbar /> : <Navbar />;
}