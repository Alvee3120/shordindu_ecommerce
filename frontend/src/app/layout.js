import localFont from "next/font/local";
import "./globals.css";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import FooterT from "@/components/shared/FooterT";
import AppLoadingShell from "./AppLoadingShell";

export const myFonts = localFont({
  src: [
    {
      path: "./font/sora.otf",
      style: "normal",
    },
  ],
  variable: "--sora",
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
    <html lang="en" className={` ${myFonts.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AppLoadingShell brandText="shordindu">
          <Navbar />
          <main> {children}</main>
          {/* <Footer /> */}
          <FooterT />
        </AppLoadingShell>
      </body>
    </html>
  );
}
