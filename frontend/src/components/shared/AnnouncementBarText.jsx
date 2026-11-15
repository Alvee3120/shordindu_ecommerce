"use client";

import { useEffect, useRef, useState } from "react";
import Marquee from "react-fast-marquee";

/**
 * One-line announcement text. When the text is wider than the bar it scrolls
 * as a marquee instead of wrapping onto a second line.
 */
export default function AnnouncementBarText({ text }) {
  const containerRef = useRef(null);
  const measureRef = useRef(null);
  const [overflowing, setOverflowing] = useState(false);
  // Keep the spacing the admin typed, but flatten newlines so it stays one line.
  const displayText = (text || "").replace(/\r?\n/g, " ");

  useEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const check = () => setOverflowing(measure.offsetWidth > container.clientWidth);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(container);
    return () => observer.disconnect();
  }, [text]);

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden whitespace-pre">
      <span ref={measureRef} aria-hidden className="invisible absolute whitespace-pre">
        {displayText}
      </span>

      {overflowing ? (
        <Marquee gradient={false} speed={45} autoFill pauseOnHover>
          <span className="pr-10">{displayText}</span>
        </Marquee>
      ) : (
        displayText
      )}
    </div>
  );
}
