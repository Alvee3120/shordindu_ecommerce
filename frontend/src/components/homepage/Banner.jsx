"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

const desktopImages = [
  "/assets/banner/banner.jpeg",
  "/assets/banner/bannerD.jpeg",
  "/assets/banner/bannerD2.jpeg",
];

const mobileImages = [
  "/assets/banner/bannerM.jpeg",
  "/assets/banner/bannerD.jpeg",
  "/assets/banner/bannerD2.jpeg",
];

const AUTO_SLIDE_INTERVAL = 3500; // ms

export default function Banner() {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef(null);

  const slideCount = desktopImages.length;

  // auto-advance
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slideCount);
    }, AUTO_SLIDE_INTERVAL);
    return () => clearInterval(timer);
  }, [slideCount]);

  const goTo = (index) => {
    setActiveIndex((index + slideCount) % slideCount);
  };

  // swipe handling (mobile)
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const SWIPE_THRESHOLD = 50;

    if (deltaX > SWIPE_THRESHOLD) {
      goTo(activeIndex - 1); // swipe right → previous
    } else if (deltaX < -SWIPE_THRESHOLD) {
      goTo(activeIndex + 1); // swipe left → next
    }
    touchStartX.current = null;
  };

  return (
    <section
      className="relative left-1/2 right-1/2 mx-[-50vw] flex h-screen w-screen min-h-150 items-center overflow-hidden bg-neutral-100 sm:h-screen sm:min-h-145"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slides — desktop */}
      <div className="hidden sm:block absolute inset-0 z-0">
        {desktopImages.map((src, i) => (
          <div
            key={src}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              i === activeIndex ? "opacity-100" : "opacity-0"
            }`}
          >
            <Image
              src={src}
              alt={`Shordindu ${i + 1}`}
              fill
              priority={i === 0}
              className="object-cover object-center"
            />
          </div>
        ))}
      </div>

      {/* Slides — mobile */}
      <div className="block sm:hidden absolute inset-0 z-0">
        {mobileImages.map((src, i) => (
          <div
            key={src}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              i === activeIndex ? "opacity-100" : "opacity-0"
            }`}
          >
            <Image
              src={src}
              alt={`Shordindu ${i + 1}`}
              fill
              priority={i === 0}
              className="object-cover object-center"
            />
          </div>
        ))}
      </div>

      {/* Shop Now button */}
      <Link
        href="/shop"
        className="absolute bottom-6 left-6 z-30 rounded-full bg-(--primary) px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105 sm:bottom-8 sm:left-10"
      >
        Shop Now
      </Link>

      {/* Tagline */}
      <p className="font-sora absolute right-6 bottom-6 z-30 max-w-[160px] text-right text-xs leading-snug font-medium text-white/90 sm:right-10 sm:bottom-8 sm:max-w-[200px] sm:text-sm">
        Step Into Effortless Elegance With Shordindu
      </p>

      {/* Dot indicators */}
      <div className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 gap-2 sm:bottom-8">
        {desktopImages.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === activeIndex ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/70"
            }`}
          />
        ))}
      </div>

      {/* Prev / Next arrows (desktop) */}
      <button
        type="button"
        onClick={() => goTo(activeIndex - 1)}
        aria-label="Previous slide"
        className="absolute top-1/2 left-4 z-30 hidden -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/50 sm:flex"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => goTo(activeIndex + 1)}
        aria-label="Next slide"
        className="absolute top-1/2 right-4 z-30 hidden -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/50 sm:flex"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </section>
  );
}