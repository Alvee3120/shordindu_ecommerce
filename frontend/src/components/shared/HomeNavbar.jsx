"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiMenu, FiX, FiSearch, FiChevronDown } from "react-icons/fi";
import { FaShoppingCart, FaUser } from "react-icons/fa";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { getCategories, buildCategoryTree } from "@/lib/categories";
import SearchBar from "./SearchBar";

const logoSrcLight = "/assets/logo/logolight.png";
const logoSrcDark = "/assets/logo/logoDark.png";

const staticLinks = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
];

export default function HomeNavbar() {
  const { user, isAuthenticated } = useAuth();
  const { cartCount } = useCart();
  const dashboardHrefByRole = {
    admin: "/dashboard/admin",
    staff: "/dashboard/staff",
    customer: "/dashboard/customer",
  };
  const accountHref = isAuthenticated
    ? dashboardHrefByRole[user?.role] ?? "/dashboard/customer"
    : "/auth/login";
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    getCategories()
      .then((data) => setCategories(Array.isArray(data) ? data : data?.results ?? []))
      .catch(() => setCategories([]));
  }, []);

  const navLinks = [
    ...staticLinks.map((link) => ({ ...link, children: [] })),
    ...buildCategoryTree(categories)
      .slice(0, 4)
      .map((cat) => ({
        label: cat.name,
        href: `/shop?category=${cat.id}`,
        children: cat.children.map((child) => ({
          label: child.name,
          href: `/shop?category=${child.id}`,
        })),
      })),
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // lock body scroll while side drawer is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // close drawer/search on resize back to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMenuOpen(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [expandedLinks, setExpandedLinks] = useState(() => new Set());
  const toggleExpandedLink = (href) => {
    setExpandedLinks((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  const openMenu = () => {
    setSearchOpen(false);
    setMenuOpen(true);
  };

  const toggleSearch = () => {
    setMenuOpen(false);
    setSearchOpen((prev) => !prev);
  };

  // not scrolled: dark logo + white text/icons (sits over a dark/hero banner)
  // scrolled: light logo + primary-colored text/icons (sits over the white/blurred bar)
  const isScrolled = scrolled || searchOpen;
  const logoSrc = isScrolled ? logoSrcLight : logoSrcDark;
  const linkColorClass = isScrolled
    ? "text-(--primary) hover:text-(--primary)/80"
    : "text-white hover:text-white/80";
  const iconColorClass = isScrolled
    ? "text-(--primary) hover:text-(--primary)/80"
    : "text-white hover:text-white/80";

  return (
    <>
      <header
        className={`fixed top-0 left-0 z-50 w-full transition-all duration-300 ${
          isScrolled ? "bg-white/70 backdrop-blur-md shadow-sm" : "bg-transparent"
        }`}
      >
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          {/* Left: nav links (desktop) / hamburger (mobile) */}
          <div className="flex flex-1 items-center">
            <ul className="hidden items-center gap-8 md:flex">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`text-sm font-medium transition-colors ${linkColorClass}`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={openMenu}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className={`flex items-center justify-center rounded-md p-2 transition-colors md:hidden ${iconColorClass}`}
            >
              <FiMenu size={22} />
            </button>
          </div>

          {/* Center: logo */}
          <div className="flex flex-1 justify-center">
            <Link
              href="/"
              className="flex items-center gap-2"
              onClick={() => {
                setMenuOpen(false);
                setSearchOpen(false);
              }}
            >
              <Image src={logoSrc} alt="Logo" width={80} height={80} priority />
            </Link>
          </div>

          {/* Right: search + user + cart */}
          <div className="flex flex-1 items-center justify-end sm:gap-1">
            {/* desktop inline search */}
            <SearchBar className="hidden w-64 lg:block" />

            {/* mobile search icon toggle */}
            <button
              type="button"
              onClick={toggleSearch}
              aria-label="Toggle search"
              aria-expanded={searchOpen}
              className={`flex items-center justify-center rounded-full p-2 transition-colors lg:hidden ${iconColorClass}`}
            >
              <FiSearch size={20} />
            </button>

            {/* user icon */}
            <Link
              href={accountHref}
              aria-label="Account"
              className={`flex items-center justify-center rounded-full p-2 transition-colors ${iconColorClass}`}
            >
              <FaUser size={20} />
            </Link>

            {/* cart icon */}
            <Link
              href="/cart"
              aria-label="Cart"
              className={`relative flex items-center justify-center rounded-full p-2 transition-colors ${iconColorClass}`}
            >
              <FaShoppingCart size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </Link>
          </div>
        </nav>

        {/* Mobile search bar — drops down below the header */}
        <div
          className={`transition-all duration-300 md:hidden ${
            searchOpen ? "max-h-20 overflow-visible border-t border-gray-200" : "max-h-0 overflow-hidden"
          }`}
        >
          <div className="bg-white/90 px-4 py-3 backdrop-blur-md">
            <SearchBar autoFocus={searchOpen} onNavigate={() => setSearchOpen(false)} />
          </div>
        </div>
      </header>

      {/* Side drawer overlay */}
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-300 md:hidden ${
          menuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />

        {/* Side drawer panel — always on a white surface, so use dark logo + primary color regardless of navbar state */}
        <div
          className={`absolute top-0 left-0 h-full w-72 max-w-[80%] bg-white shadow-xl transition-transform duration-300 ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
            <Image src={logoSrcLight} alt="Logo" width={56} height={56} />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="flex items-center justify-center rounded-md p-2 text-(--primary)"
            >
              <FiX size={20} />
            </button>
          </div>

          <ul className="flex flex-col gap-1 px-3 py-4">
            {navLinks.map((link) => (
              <li key={link.href}>
                <div className="flex items-center">
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="block flex-1 rounded-md px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-(--primary)/90"
                  >
                    {link.label}
                  </Link>
                  {link.children.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleExpandedLink(link.href)}
                      aria-label={expandedLinks.has(link.href) ? `Collapse ${link.label}` : `Expand ${link.label}`}
                      aria-expanded={expandedLinks.has(link.href)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-400 hover:text-(--primary)"
                    >
                      <FiChevronDown
                        size={16}
                        className={`transition-transform duration-200 ${expandedLinks.has(link.href) ? "rotate-180" : ""}`}
                      />
                    </button>
                  )}
                </div>
                {link.children.length > 0 && (
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      expandedLinks.has(link.href) ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <ul className="ml-3 flex flex-col gap-0.5 border-l border-gray-200 py-1 pl-3">
                      {link.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            onClick={() => setMenuOpen(false)}
                            className="block rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-(--primary)/90"
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-2 flex items-center gap-4 border-t border-gray-200 px-4 py-4">
            <Link
              href={accountHref}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-(--primary)/90"
            >
              <FaUser size={18} />
              Account
            </Link>
            <Link
              href="/cart"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-(--primary)/90"
            >
              <FaShoppingCart size={18} />
              Cart
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}