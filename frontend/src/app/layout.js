import { Suspense } from "react";
import localFont from "next/font/local";
import "./globals.css";
import NavbarSwitcher from "@/components/shared/NavbarSwitcher";
import Footer from "@/components/shared/Footer";
import FooterT from "@/components/shared/FooterT";
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
  icons: {
    icon: [
      {
        url: "/favicon.svg",
        href: "/favicon.svg",
      },
    ],
  },
  title: "Shordindu",
  description: "Hello Beautiful Soul",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={` ${myFonts.variable} ${myFontsT.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
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
                <FooterT />
              </AppLoadingShell>
            </SmoothScroll>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}