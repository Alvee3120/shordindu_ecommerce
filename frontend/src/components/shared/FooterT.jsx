"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FaInstagram, FaFacebookF } from "react-icons/fa";
import { getCategories } from "@/lib/categories";

const logoSrc = "/assets/logo/logoDark.png";

const policyLinks = [
  { label: "Terms & Conditions", href: "/footerLinks/terms" },
  { label: "Privacy Policy", href: "/footerLinks/privacy" },
  { label: "Return & Exchange & Cancellation Policy", href: "/footerLinks/return-policy" },
];

const otherLinks = [
  { label: "Order & Delivery Process", href: "/footerLinks/order-delivery" },
];

const FOOTER_CATEGORY_NAMES = ["Men", "Women", "Dress", "Saree", "Bag"];

export default function FooterT() {
  const [categoryLinks, setCategoryLinks] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getCategories()
      .then((data) => {
        if (cancelled) return;
        const results = Array.isArray(data) ? data : data.results ?? [];
        const filtered = results.filter((cat) =>
          FOOTER_CATEGORY_NAMES.some(
            (name) => name.toLowerCase() === (cat.name ?? "").trim().toLowerCase()
          )
        );
        setCategoryLinks(
          filtered.map((cat) => ({ id: cat.id, label: cat.name, href: `/shop?category=${cat.id}` }))
        );
      })
      .catch(() => {
        if (!cancelled) setCategoryLinks([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer className="relative overflow-hidden bg-(--primary) text-white">
      {/* Giant brand signature — background layer */}
      <div className="hidden sm:block pointer-events-none absolute inset-x-0 bottom-28 select-none overflow-hidden font-sora">
        <p className="-mb-4 translate-x-[-2%] font-sora text-center text-[18vw] leading-none font-bold whitespace-nowrap text-white/5 sm:text-[15vw]">
          shordindu.
        </p>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-16 sm:px-8">
        <div className="grid grid-cols-2 gap-12 md:grid-cols-[1.3fr_1fr_1fr_1.2fr]">
          {/* Column 1: Logo, description, socials */}
          <div>
            <Image
              src={logoSrc}
              alt="Shordindu"
              width={140}
              height={40}
              className="mb-6 h-auto w-32"
            />
            <p className="mb-6 max-w-xs text-sm leading-relaxed text-gray-400">
              Hello Beautiful, This is SHORDINDU — a youth-centric clothing
              brand that aims to promote ETHNICITY.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://www.instagram.com/wear_shordindu/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow us on Instagram"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-600 text-gray-300 transition-colors hover:border-white hover:text-white"
              >
                <FaInstagram size={16} />
              </a>
              <a
                href="https://facebook.com/shordindu"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow us on Facebook"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-600 text-gray-300 transition-colors hover:border-white hover:text-white"
              >
                <FaFacebookF size={15} />
              </a>
            </div>
          </div>

          {/* Column 2: Category */}
          <div>
            <h4 className="mb-5 text-sm font-semibold tracking-widest text-(--moon)">
              CATEGORY
            </h4>
            <ul className="flex flex-col gap-3">
              {categoryLinks.map((link) => (
                <li key={link.id}>
                  <Link
                    href={link.href}
                    className="text-[15px] text-gray-200 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Policy */}
          <div>
            <h4 className="mb-5 text-sm font-semibold tracking-widest text-(--moon)">
              POLICY
            </h4>
            <ul className="flex flex-col gap-3">
              {policyLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[15px] leading-snug text-gray-200 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Others */}
          <div>
            <h4 className="mb-5 text-sm font-semibold tracking-widest text-(--moon)">
              OTHERS
            </h4>
            <ul className="flex flex-col gap-3">
              {otherLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[15px] text-gray-200 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li className="pt-2 text-[15px] leading-relaxed text-gray-200">
                Grievance and Nodal Officer:
                <br />
                <span className="text-sm text-gray-400">
                  (10 am – 6 pm Saturday to Thursday)
                </span>
              </li>
              <li className="text-[15px] text-gray-200">Customer Care</li>
              <li>
                <a
                  href="tel:+8801935600400"
                  className="text-[15px] text-gray-200 transition-colors hover:text-white"
                >
                  ✆ +880 1935 600 400
                </a>
              </li>
              <li>
                <a
                  href="mailto:contact.shordindu@gmail.com"
                  className="text-[15px] text-gray-200 transition-colors hover:text-white"
                >
                  ✉ contact.shordindu@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-14 border-t border-gray-700" />

        {/* Bottom bar */}
        <div className="flex flex-col items-start justify-between gap-4 pt-8 sm:flex-row sm:items-center">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} Shordindu. All rights reserved.
          </p>
          <div className="hidden sm:flex items-center gap-6">
            <Link
              href="/footerLinks/terms"
              className="text-xs font-medium tracking-wide text-gray-400 uppercase transition-colors hover:text-white"
            >
              Terms & Conditions
            </Link>
            <Link
              href="/footerLinks/privacy"
              className="text-xs font-medium tracking-wide text-gray-400 uppercase transition-colors hover:text-white"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
        
      </div>
    </footer>
  );
}