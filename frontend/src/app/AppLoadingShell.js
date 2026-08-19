"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export default function LoadingScreen({ children, onComplete }) {
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [done, setDone] = useState(false);
  const progressRef = useRef(0);

  const logoSrc = "/favicon.svg";

  useEffect(() => {
    let cancelled = false;
    let loaded = 0;

    const setPct = (val) => {
      // progress only ever moves forward, eases toward the real value
      if (val > progressRef.current) {
        progressRef.current = val;
        setProgress(val);
      }
    };

    const trackRealLoading = () => {
      const assets = [
        ...document.images,
        ...document.querySelectorAll('link[rel="stylesheet"]'),
        ...document.scripts,
      ];
      const total = Math.max(assets.length, 1);

      const bump = () => {
        loaded += 1;
        setPct(Math.min((loaded / total) * 100, 99));
      };

      assets.forEach((el) => {
        const alreadyLoaded = el.tagName === "IMG" ? el.complete : true;
        if (alreadyLoaded) {
          bump();
        } else {
          el.addEventListener("load", bump, { once: true });
          el.addEventListener("error", bump, { once: true });
        }
      });
    };

    trackRealLoading();

    // gentle fallback crawl so the bar never looks frozen if asset counting under-reports
    const crawl = setInterval(() => {
      if (cancelled) return;
      setPct(progressRef.current + (95 - progressRef.current) * 0.05);
    }, 150);

    const finish = () => !cancelled && setPct(100);
    if (document.readyState === "complete") {
      finish();
    } else {
      window.addEventListener("load", finish);
    }

    return () => {
      cancelled = true;
      clearInterval(crawl);
      window.removeEventListener("load", finish);
    };
  }, []);

  useEffect(() => {
    if (progress >= 100) {
      const exitTimer = setTimeout(() => setExiting(true), 300);
      const doneTimer = setTimeout(() => {
        setDone(true);
        onComplete?.();
      }, 1000);
      return () => {
        clearTimeout(exitTimer);
        clearTimeout(doneTimer);
      };
    }
  }, [progress, onComplete]);

  if (done) return <div className="relative z-0">{children}</div>;

  const pct = Math.floor(progress);

  // wave svg tile: white fill under the curve, transparent above it
  const waveSVG = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 20'><path d='M0 10 C 25 20, 25 0, 50 10 C 75 20, 75 0, 100 10 L100 20 L0 20 Z' fill='white'/></svg>`
  );

  return (
    <>
      <div className="relative z-0">{children}</div>
      <div
        className={`fixed inset-0 z-[9999] flex items-center justify-center bg-(--primary) transition-all duration-700 ease-[cubic-bezier(0.65,0,0.35,1)] ${
          exiting ? "scale-125 opacity-0" : "scale-100 opacity-100"
        }`}
      >
      {/* ambient background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-20 h-96 w-96 rounded-full bg-(--moon)/20 blur-[120px]" />
        <div className="absolute -right-20 -bottom-40 h-96 w-96 rounded-full bg-(--moon)/20 blur-[120px]" />
      </div>

      {/* card */}
      <div className="relative mx-4 flex flex-col gap-3 w-full max-w-3xl items-center justify-center overflow-hidden rounded-2xl border border-white/5 py-24 shadow-2xl">
        <Image src={logoSrc}  alt="Logo" width={90} height={90} priority className="w-15 h-15 md:w-22.5 md:h-22.5"  />
        <div className="relative">
          {/* base (dim) text — the empty vessel */}
          <p className="font-sora text-[13vw] leading-none font-extrabold whitespace-nowrap text-white/10 select-none sm:text-[7rem]">
            shordindu
          </p>

          {/* water-filled text, clipped to the glyph shapes */}
          <p
            className="water-fill font-sora absolute inset-0 text-[13vw] leading-none font-extrabold whitespace-nowrap select-none sm:text-[7rem]"
            style={{
              backgroundImage: `linear-gradient(white, white), url("data:image/svg+xml,${waveSVG}")`,
              backgroundRepeat: "no-repeat, repeat-x",
              backgroundSize: `100% ${pct}%, 60px 20px`,
              backgroundPosition: `0 100%, 0 calc(${100 - pct}% - 10px)`,
              transition: "background-size 0.4s linear, background-position 0.4s linear",
            }}
          >
            shordindu
          </p>

          {/* loading counter */}
          <span className="absolute -bottom-6 right-0 font-sans text-xs tracking-wide text-white/50">
            loading... {pct}%
          </span>
        </div>
      </div>

      </div>
    </>
  );
}