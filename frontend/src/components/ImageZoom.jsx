"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { FiZoomIn } from "react-icons/fi";

/**
 * Product image with a cursor-tracking zoom lens on hover (desktop/mouse only).
 * The lens position is written straight to the DOM via a ref on every
 * mousemove, skipping React re-renders so tracking stays glued to the cursor.
 */
export default function ImageZoom({ src, alt, sizes, priority }) {
  const [zooming, setZooming] = useState(false);
  const lensRef = useRef(null);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    if (lensRef.current) {
      lensRef.current.style.backgroundPosition = `${x}% ${y}%`;
    }
  };

  return (
    <div
      className="relative h-full w-full [@media(hover:hover)_and_(pointer:fine)]:cursor-zoom-in"
      onMouseEnter={() => setZooming(true)}
      onMouseLeave={() => setZooming(false)}
      onMouseMove={handleMouseMove}
    >
      <Image src={src} alt={alt} fill className="object-cover" sizes={sizes} priority={priority} />

      <div
        ref={lensRef}
        aria-hidden
        className={`pointer-events-none absolute inset-0 hidden opacity-0 transition-opacity duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:block ${
          zooming ? "opacity-100" : ""
        }`}
        style={{
          backgroundImage: `url(${src})`,
          backgroundSize: "275%",
          backgroundPosition: "50% 50%",
          backgroundRepeat: "no-repeat",
        }}
      />

      {!zooming && (
        <div className="pointer-events-none absolute top-3 right-3 hidden h-8 w-8 items-center justify-center rounded-full bg-white/80 text-neutral-600 shadow-md backdrop-blur [@media(hover:hover)_and_(pointer:fine)]:flex">
          <FiZoomIn size={16} />
        </div>
      )}
    </div>
  );
}
