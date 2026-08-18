import localFont from "next/font/local";
import "./globals.css";

export const myFonts = localFont({
  src: [
    {
      path: "./font/sora.otf",
      style: "normal",
    },
  ],
  variable: '--sora'
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
    <html
      lang="en"
      className={` ${myFonts.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
