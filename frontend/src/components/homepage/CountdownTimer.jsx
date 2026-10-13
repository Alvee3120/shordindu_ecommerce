"use client";

import { useEffect, useState } from "react";
import { FiClock } from "react-icons/fi";

function remainingParts(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const pad = (n) => String(n).padStart(2, "0");

/**
 * Live "Ends in" countdown to `endsAt` (ISO datetime from the API).
 * Renders nothing until mounted — server and browser clocks differ, so the
 * time can't be part of the server HTML. Calls `onExpire` once at zero.
 */
export default function CountdownTimer({ endsAt, onExpire, label = "Ends in" }) {
  const [now, setNow] = useState(null);
  const end = new Date(endsAt).getTime();

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const interval = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);

  const remaining = now == null ? null : end - now;
  const expired = remaining != null && remaining <= 0;

  useEffect(() => {
    if (expired) onExpire?.();
  }, [expired, onExpire]);

  // Same height as the timer, so the header doesn't jump when it appears.
  if (now == null) return <div className="h-6" aria-hidden="true" />;
  if (Number.isNaN(end) || expired) return null;

  const { days, hours, minutes, seconds } = remainingParts(remaining);
  const units = [
    ...(days > 0 ? [{ value: days, unit: "d" }] : []),
    { value: pad(hours), unit: "h" },
    { value: pad(minutes), unit: "m" },
    { value: pad(seconds), unit: "s" },
  ];

  return (
    <div
      role="timer"
      aria-label={`${label} ${days ? `${days} days ` : ""}${hours} hours ${minutes} minutes`}
      className="flex items-center gap-2 text-(--primary)"
    >
      <FiClock size={14} className="shrink-0" aria-hidden="true" />
      <span className="text-xs font-medium tracking-wide uppercase">{label}</span>
      <span className="flex items-center gap-1" aria-hidden="true">
        {units.map(({ value, unit }) => (
          <span
            key={unit}
            className="min-w-9 rounded-md bg-(--primary) px-1.5 py-1 text-center text-xs font-semibold text-white tabular-nums"
          >
            {value}
            <span className="ml-0.5 font-normal text-white/70">{unit}</span>
          </span>
        ))}
      </span>
    </div>
  );
}
