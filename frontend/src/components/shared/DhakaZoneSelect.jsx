"use client";

/**
 * Zone dropdown for Dhaka-district addresses — the zone decides between the
 * Inside Dhaka and Dhaka Outer Zones delivery charge. Zones come from the
 * delivery-charge config (`config.dhaka_zones`), never a local list.
 * Controlled: `value` (zone name) and `onChange(zone)`.
 */
export default function DhakaZoneSelect({ config, value, onChange, error, id = "zone", className = "" }) {
  const zones = config?.dhaka_zones ?? [];
  return (
    <div className={className}>
      <select
        id={id}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={!config}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary) disabled:opacity-60 ${
          error ? "border-red-400" : "border-neutral-300"
        } ${value ? "text-neutral-800" : "text-neutral-400"}`}
      >
        <option value="" disabled>
          {config ? "Select zone" : "Loading zones..."}
        </option>
        {zones.map((zone) => (
          <option key={zone.name} value={zone.name} className="text-neutral-800">
            {zone.name}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
