// components/auth/AuthLayout.jsx
import Image from "next/image";

const bgImage = "/assets/banner/banner.jpeg";
const logoSrc = "/assets/logo/logoDark.png";

export default function AuthLayout({ children }) {
  return (
    <main className="relative flex min-h-screen w-full max-w-7xl pt-10 items-center overflow-hidden bg-neutral-900">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <Image
          src={bgImage}
          alt="Shordindu"
          fill
          priority
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/35" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto flex w-full  flex-col items-center justify-between gap-16 px-6 py-16 sm:px-8 lg:flex-row lg:items-center lg:gap-8">
        {/* Left: branding */}
        <div className="hidden sm:block w-full ml-20 max-w-md text-white lg:pb-10">
          <Image
            src={logoSrc}
            alt="Shordindu"
            width={90}
            height={90}
            className="mb-8"
          />

          <h1 className="font-sora mb-4 text-5xl leading-[1.05] uppercase font-extrabold tracking-tight sm:text-6xl">
           Join Our
            <br />
            Shordindu family
          </h1>

          <p className="mb-1 text-lg font-medium text-white/90">
            Where ethnicity meets everyday elegance.
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-white/70">
            Join Shordindu and discover clothing that <br /> celebrates who you are.
          </p>
        </div>

        {/* Right: form card */}
        <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white/15 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
          {children}
        </div>
      </div>
    </main>
  );
}