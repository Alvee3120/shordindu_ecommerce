import { Suspense } from "react";
import localFont from "next/font/local";
import "./globals.css";
import NavbarSwitcher from "@/components/shared/NavbarSwitcher";
import FooterSwitcher from "@/components/shared/FooterSwitcher";
import SmoothScroll from "@/components/shared/SmoothScroll";
import AppLoadingShell from "./AppLoadingShell";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";

export const myFonts = localFont({
  src: [
    {
      path: "./font/sora.otf",
      style: "normal",
    },
  ],
  variable: "--sora",
});

export const myFontsT = localFont({
  src: [
    {
      path: "./font/bangla.ttf",
      style: "normal",
    },
  ],
  variable: "--bangla",
});

export const metadata = {
  // Small raster icons generated from public/favicon.svg — that SVG is ~620 KB
  // (a traced image), which browsers often refuse to use as a tab icon, and
  // Safari doesn't support SVG favicons at all.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
  title: "Shordindu",
  description: "Hello Beautiful Soul",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={` ${myFonts.variable} ${myFontsT.variable} h-full antialiased`}>
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla's
          cz-shortcut-listen) add attributes to <body> before React hydrates.
          It only covers this element's own attributes, not its children. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Toaster position="top-center" richColors />
        <AuthProvider>
          <CartProvider>
            <SmoothScroll>
              <AppLoadingShell brandText="shordindu">
                <Suspense fallback={null}>
                  <NavbarSwitcher />
                </Suspense>
                <main>{children}</main>
                {/* <Footer /> */}
                <FooterSwitcher />
              </AppLoadingShell>
            </SmoothScroll>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}