"use client";

import { useEffect, useRef, useState } from "react";

const MIN_VISIBLE_DURATION = 1800; // ms — floor so the animation is always visible, even on instant loads

export default function LoadingScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [done, setDone] = useState(false);
  const progressRef = useRef(0);
  const startTimeRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let loaded = 0;
    startTimeRef.current = performance.now();

    const setPct = (val) => {
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
        if (alreadyLoaded) bump();
        else {
          el.addEventListener("load", bump, { once: true });
          el.addEventListener("error", bump, { once: true });
        }
      });
    };

    trackRealLoading();

    // fallback crawl so it never looks frozen
    const crawl = setInterval(() => {
      if (!cancelled) setPct(progressRef.current + (95 - progressRef.current) * 0.06);
    }, 150);

    const finish = () => {
      if (cancelled) return;
      const elapsed = performance.now() - startTimeRef.current;
      const remaining = Math.max(MIN_VISIBLE_DURATION - elapsed, 0);
      setTimeout(() => !cancelled && setPct(100), remaining);
    };

    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish);

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

  if (done) return null;

  const pct = Math.floor(progress);

  const waveSVG = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 20'><path d='M0 10 C 25 20, 25 0, 50 10 C 75 20, 75 0, 100 10 L100 20 L0 20 Z' fill='white'/></svg>`
  );

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-(--primary) transition-all duration-700 ease-[cubic-bezier(0.65,0,0.35,1)] ${
        exiting ? "scale-125 opacity-0" : "scale-100 opacity-100"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-20 h-96 w-96 rounded-full bg-(--moon)/20 blur-[120px]" />
        <div className="absolute -right-20 -bottom-40 h-96 w-96 rounded-full bg-(--moon)/20 blur-[120px]" />
      </div>

      <div className="relative mx-4 flex w-full max-w-3xl items-center justify-center overflow-hidden rounded-2xl border border-white/5 py-24 shadow-2xl">
        <div className="relative">
          {/* base (dim) text — the empty vessel */}
          <p className="font-sora text-[13vw] leading-none font-extrabold whitespace-nowrap text-white/10 select-none sm:text-[7rem]">
            shordindu
          </p>

          {/* water-filled text */}
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

          <span className="absolute -bottom-6 right-0 font-sans text-xs tracking-wide text-white/50">
            loading... {pct}%
          </span>
        </div>
      </div>

      <style jsx>{`
        .water-fill {
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          animation: wave-slosh 1.4s linear infinite;
        }
        @keyframes wave-slosh {
          from {
            background-position-x: 0, 0;
          }
          to {
            background-position-x: 0, 60px;
          }
        }
      `}</style>
    </div>
  );
}