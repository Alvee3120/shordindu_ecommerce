"use client";

const PALETTE = [
  "bg-(--primary)/10 text-(--primary)",
  "bg-blue-50 text-blue-700",
  "bg-amber-50 text-amber-700",
  "bg-emerald-50 text-emerald-700",
  "bg-purple-50 text-purple-700",
  "bg-rose-50 text-rose-700",
  "bg-cyan-50 text-cyan-700",
];

function initialsFor({ name, email, phone }) {
  const source = (name || email || phone || "?").trim();
  if (!source) return "?";
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export default function InitialsAvatar({ name, email, phone, id, className = "" }) {
  const seed = String(id ?? name ?? email ?? phone ?? "");
  const paletteIndex = seed
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0) % PALETTE.length;

  return (
    <span
      aria-hidden="true"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${PALETTE[paletteIndex]} ${className}`}
    >
      {initialsFor({ name, email, phone })}
    </span>
  );
}
