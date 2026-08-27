"use client";

import { useState } from "react";
import { FiPhone } from "react-icons/fi";

const STORES = [
  {
    name: "Shordindu Bashundhara City",
    address:
      "Shop 97, Block C, Level 2, Bashundhara City Shopping Mall, Karwan Bazar, Dhaka – 1215, Bangladesh",
    phone: "+8801958-662207",
  },
  {
    name: "Shordindu Mirpur",
    address:
      "Shop No. F2, 2nd Floor, Lift 02, Rupayan Latifa Shamsuddin Square, Mirpur 01, Dhaka, Bangladesh",
    phone: "+8801958-662206",
  },
  {
    name: "Shordindu New Market",
    address: "Shop No. 159, Gate No. 1, New Market, Dhaka, Bangladesh",
    phone: "+8801958-662208",
  },
  {
    name: "Shordindu Uttara",
    address:
      "Shop No. 315, Level 3, Grand Zam Zam Tower, Sector 13, Uttara, Dhaka, Bangladesh",
    phone: "+8801958-662209",
  },
  {
    name: "Shordindu Bailey Road",
    address:
      "Shop No. 2-7, 3rd Floor, Capital Siraj Centre, 10 Bailey Road, Dhaka, Bangladesh",
    phone: "+8801958-662210",
  },
  {
    name: "Shordindu Sylhet",
    address:
      "Kumarpara Main Road (Beside Ram Krishna Mission), Sylhet, Bangladesh",
    phone: "+8801958-662214",
  },
  {
    name: "Shordindu London",
    address:
      "Shordindu - Lifestyle Cafe & Boutique, 25 Plashet Grove, Green Street, London, E6 1AD, United Kingdom",
    phone: "+447501885001",
  },
];

export default function StoreLocator() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = STORES[activeIndex];
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(
    `${active.name}, ${active.address}`
  )}&output=embed`;

  return (
    <section className="w-full bg-white px-6 py-16 sm:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-10 text-center">
          <h2 className="font-sora text-3xl font-medium tracking-wide text-(--primary)">
            OUR OUTLETS
          </h2>
          <div className="mx-auto mt-3 h-px w-16 bg-neutral-300" />
          <p className="mt-4 text-sm text-neutral-500">
            We make it easier for you to find our stores.
          </p>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="flex flex-col lg:w-1/2">
            {STORES.map((store, index) => {
              const isActive = index === activeIndex;
              return (
                <button
                  key={store.name}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`border-b border-neutral-200 py-4 text-left first:pt-0 last:border-b-0 ${
                    isActive ? "opacity-100" : "opacity-70 hover:opacity-100"
                  }`}
                >
                  <p className="text-xs font-semibold tracking-wide text-neutral-900">
                    {store.name.toUpperCase()}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">{store.address}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-neutral-400">
                    <FiPhone size={12} />
                    {store.phone}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-neutral-200 lg:w-1/2">
            <iframe
              key={active.name}
              title={active.name}
              src={mapSrc}
              className="h-full w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />

            <div className="absolute bottom-4 left-4 max-w-xs rounded-lg border border-neutral-200 bg-white p-4 shadow-lg">
              <p className="font-sora text-sm font-semibold text-neutral-900">
                {active.name}
              </p>
              <p className="mt-1 text-xs text-neutral-500">{active.address}</p>
              <p className="mt-1 text-xs text-neutral-500">Call: {active.phone}</p>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                  active.address
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline"
              >
                Get Directions
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
