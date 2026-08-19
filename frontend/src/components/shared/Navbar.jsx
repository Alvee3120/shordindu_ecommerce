"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiMenu, FiX, FiSearch,  } from "react-icons/fi";
import { FaShoppingCart, FaUser } from "react-icons/fa";

const logoSrc = "/assets/logo/logolight.png";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Men", href: "/men" },
  { label: "Women", href: "/women" },
  { label: "Bag", href: "/bag" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

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

  const openMenu = () => {
    setSearchOpen(false);
    setMenuOpen(true);
  };

  const toggleSearch = () => {
    setMenuOpen(false);
    setSearchOpen((prev) => !prev);
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 z-50 w-full transition-all duration-300 ${
          scrolled || searchOpen
            ? "bg-white/70 backdrop-blur-md shadow-sm"
            : "bg-transparent"
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
                    className="text-sm font-medium text-gray-700 transition-colors hover:text-(--primary)/90"
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
              className="flex items-center justify-center rounded-md p-2 text-gray-700 md:hidden"
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
            <div className="hidden w-56 items-center gap-2 rounded-full bg-gray-100 px-4 py-2 lg:flex">
              <FiSearch size={16} className="text-gray-400" />
              <input
                type="text"
                placeholder="Search"
                className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
              />
            </div>

            {/* mobile search icon toggle */}
            <button
              type="button"
              onClick={toggleSearch}
              aria-label="Toggle search"
              aria-expanded={searchOpen}
              className="flex items-center justify-center rounded-full p-2 text-(--primary) hover:text-(--primary)/90 lg:hidden"
            >
              <FiSearch size={20} />
            </button>

            {/* user icon */}
            <Link
              href="/account"
              aria-label="Account"
              className="flex items-center justify-center rounded-full p-2 text-(--primary) hover:text-(--primary)/90"
            >
              <FaUser size={20} />
            </Link>

            {/* cart icon */}
            <Link
              href="/cart"
              aria-label="Cart"
              className="relative flex items-center justify-center rounded-full p-2 text-(--primary) hover:text-(--primary)/90"
            >
              <FaShoppingCart size={20} />
              {/* optional item-count badge */}
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">2</span>
            </Link>
          </div>
        </nav>

        {/* Mobile search bar — drops down below the header */}
        <div
          className={`overflow-hidden transition-all duration-300 md:hidden ${
            searchOpen ? "max-h-20 border-t border-gray-200" : "max-h-0"
          }`}
        >
          <div className="bg-white/90 px-4 py-3 backdrop-blur-md">
            <div className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2">
              <FiSearch size={16} className="text-gray-400" />
              <input
                type="text"
                autoFocus={searchOpen}
                placeholder="Search"
                className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Side drawer overlay */}
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-300 md:hidden ${
          menuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div
          className="absolute inset-0 bg-black/40"
          onClick={() => setMenuOpen(false)}
        />

        {/* Side drawer panel */}
        <div
          className={`absolute top-0 left-0 h-full w-72 max-w-[80%] bg-white shadow-xl transition-transform duration-300 ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
            <Image src={logoSrc} alt="Logo" width={56} height={56} />
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
                <Link
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-md px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-(--primary)/90"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-2 flex items-center gap-4 border-t border-gray-200 px-4 py-4">
            <Link
              href="/account"
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