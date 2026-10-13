"use client";

export default function MetricToggle({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-neutral-100 p-1">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            value === option.key
              ? "bg-white text-(--primary) shadow-sm"
              : "text-neutral-500 hover:text-neutral-700"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
