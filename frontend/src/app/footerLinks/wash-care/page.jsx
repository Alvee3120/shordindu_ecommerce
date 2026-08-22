"use client";

import { useState } from "react";

const content = {
  en: {
    intro: `Take care of your garments the right way. Follow these simple guidelines to keep your clothes looking their best for longer.`,
    tips: [
      "Wash similar colors together in cold water to prevent bleeding and fading.",
      "Turn garments inside out before washing to protect prints and embroidery.",
      "Use a mild detergent and avoid bleach unless stated on the care label.",
      "Air dry in shade instead of direct sunlight to preserve color and fabric quality.",
      "Iron on a low to medium heat setting, avoiding direct contact with prints or embellishments.",
      "Always check the care label on the garment for specific washing instructions.",
    ],
  },
  bn: {
    intro: `আপনার পোশাক সঠিকভাবে যত্ন নিন। দীর্ঘদিন আপনার পোশাকের মান ও রং ঠিক রাখতে এই নির্দেশনাগুলো অনুসরণ করুন।`,
    tips: [
      "রং ওঠা এবং মলিন হওয়া রোধ করতে একই ধরনের রঙের কাপড় একসাথে ঠান্ডা পানিতে ধুয়ে নিন।",
      "প্রিন্ট ও এমব্রয়ডারি রক্ষা করতে ধোয়ার আগে পোশাক উল্টো করে নিন।",
      "কেয়ার লেবেলে উল্লেখ না থাকলে ব্লিচ এড়িয়ে হালকা ডিটারজেন্ট ব্যবহার করুন।",
      "রং ও কাপড়ের মান বজায় রাখতে সরাসরি রোদের পরিবর্তে ছায়ায় শুকান।",
      "প্রিন্ট বা অলংকরণের সরাসরি সংস্পর্শ এড়িয়ে কম থেকে মাঝারি তাপে ইস্ত্রি করুন।",
      "নির্দিষ্ট ধোয়ার নির্দেশনার জন্য সবসময় পোশাকের কেয়ার লেবেল দেখুন।",
    ],
  },
};

export default function WashCarePage() {
  const [lang, setLang] = useState("en");
  const data = content[lang];

  return (
    <main className="text-(--primary)">
      <section className="relative overflow-hidden border-b border-black/10 px-6 pt-32 pb-16 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="font-sora text-xs font-semibold tracking-widest text-black/40">
              CARE
            </p>

            <div className="flex items-center gap-1 rounded-full border border-black/10 bg-black/5 p-1">
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  lang === "en" ? "bg-(--primary) text-white" : "text-black/50 hover:text-black"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang("bn")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  lang === "bn" ? "bg-(--primary) text-white" : "text-black/50 hover:text-black"
                }`}
              >
                বাংলা
              </button>
            </div>
          </div>

          <h1 className={`${lang === "en" ? "font-sora" : "font-bangla"} text-4xl font-extrabold sm:text-5xl`}>
            {lang === "en" ? "Wash & Care Guide" : "ওয়াশ ও কেয়ার গাইড"}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-black/50">{data.intro}</p>
        </div>
      </section>

      <section className="px-6 py-16 sm:px-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-12" lang={lang === "bn" ? "bn" : "en"}>
          <article>
            <h2 className={`${lang === "en" ? "font-sora" : "font-bangla"} mb-4 text-2xl font-bold sm:text-[28px]`}>
              {lang === "en" ? "Care instructions" : "যত্নের নির্দেশনা"}
            </h2>
            <ol className="flex flex-col gap-3">
              {data.tips.map((tip, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-black/60">
                  <span className="font-sora shrink-0 text-black/30">{String(i + 1).padStart(2, "0")}</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ol>
          </article>

          <div className="rounded-2xl border border-black/10 bg-black/[0.03] p-6 sm:p-8">
            <h3 className="font-sora mb-2 text-lg font-bold">
              {lang === "en" ? "Have a question about care?" : "যত্ন নিয়ে প্রশ্ন আছে?"}
            </h3>
            <p className="mb-4 text-sm leading-relaxed text-black/50">
              {lang === "en"
                ? "Contact our customer care team for garment-specific advice."
                : "পোশাক-নির্দিষ্ট পরামর্শের জন্য আমাদের কাস্টমার কেয়ার টিমের সাথে যোগাযোগ করুন।"}
            </p>
            <a
              href="tel:+8801935600400"
              className="text-sm font-medium text-black underline underline-offset-4 hover:text-black/80"
            >
              +880 1935 600 400
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
