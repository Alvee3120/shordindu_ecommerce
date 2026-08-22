"use client";

import { useState } from "react";

const content = {
  en: {
    intro: `Not sure which size to pick? Use the chart below to find your best fit. Measurements are in inches — for the most accurate result, measure a similar garment you already own and compare it to the chart.`,
    table: {
      headers: ["Size", "Chest", "Waist", "Hip", "Length"],
      rows: [
        ["S", "36", "30", "38", "27"],
        ["M", "38", "32", "40", "28"],
        ["L", "40", "34", "42", "29"],
        ["XL", "42", "36", "44", "30"],
        ["XXL", "44", "38", "46", "31"],
      ],
    },
    tips: [
      "Chest: Measure around the fullest part of your chest, keeping the tape level under your arms.",
      "Waist: Measure around your natural waistline, keeping the tape comfortably loose.",
      "Hip: Measure around the fullest part of your hips.",
      "Length: Measure from the highest point of the shoulder down to the desired hem.",
      "If you're between sizes, we recommend sizing up for a more relaxed fit.",
    ],
  },
  bn: {
    intro: `কোন সাইজটি বেছে নেবেন তা নিশ্চিত নন? আপনার সঠিক মাপ খুঁজে পেতে নিচের চার্টটি ব্যবহার করুন। মাপগুলো ইঞ্চিতে দেওয়া আছে — সবচেয়ে সঠিক ফলাফলের জন্য, আপনার কাছে থাকা একটি একই ধরনের পোশাক মেপে চার্টের সাথে তুলনা করুন।`,
    table: {
      headers: ["সাইজ", "বুক", "কোমর", "হিপ", "দৈর্ঘ্য"],
      rows: [
        ["S", "36", "30", "38", "27"],
        ["M", "38", "32", "40", "28"],
        ["L", "40", "34", "42", "29"],
        ["XL", "42", "36", "44", "30"],
        ["XXL", "44", "38", "46", "31"],
      ],
    },
    tips: [
      "বুক: বাহুর নিচে টেপ সমান রেখে বুকের সবচেয়ে চওড়া অংশ পরিমাপ করুন।",
      "কোমর: আপনার স্বাভাবিক কোমরের চারপাশে, টেপ আরামদায়কভাবে ঢিলে রেখে পরিমাপ করুন।",
      "হিপ: হিপের সবচেয়ে চওড়া অংশ পরিমাপ করুন।",
      "দৈর্ঘ্য: কাঁধের সর্বোচ্চ বিন্দু থেকে কাঙ্ক্ষিত হেম পর্যন্ত পরিমাপ করুন।",
      "আপনি দুই সাইজের মাঝামাঝি হলে, আরামদায়ক ফিটের জন্য বড় সাইজ নেওয়ার পরামর্শ দিচ্ছি।",
    ],
  },
};

export default function SizeGuidePage() {
  const [lang, setLang] = useState("en");
  const data = content[lang];

  return (
    <main className="text-(--primary)">
      <section className="relative overflow-hidden border-b border-black/10 px-6 pt-32 pb-16 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="font-sora text-xs font-semibold tracking-widest text-black/40">
              SIZING
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
            {lang === "en" ? "Size Guide" : "সাইজ গাইড"}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-black/50">{data.intro}</p>
        </div>
      </section>

      <section className="px-6 py-16 sm:px-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-12" lang={lang === "bn" ? "bn" : "en"}>
          <div className="overflow-x-auto rounded-2xl border border-black/10">
            <table className="w-full min-w-[420px] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-black/[0.03]">
                  {data.table.headers.map((h) => (
                    <th key={h} className="px-4 py-3 font-semibold text-black/70">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.table.rows.map((row) => (
                  <tr key={row[0]} className="border-t border-black/10">
                    {row.map((cell, i) => (
                      <td key={i} className="px-4 py-3 text-black/60">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <article>
            <h2 className={`${lang === "en" ? "font-sora" : "font-bangla"} mb-4 text-2xl font-bold sm:text-[28px]`}>
              {lang === "en" ? "How to measure" : "কীভাবে পরিমাপ করবেন"}
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
              {lang === "en" ? "Still unsure about your size?" : "এখনও আপনার সাইজ নিয়ে অনিশ্চিত?"}
            </h3>
            <p className="mb-4 text-sm leading-relaxed text-black/50">
              {lang === "en"
                ? "Contact our customer care team and we'll help you find the right fit."
                : "আমাদের কাস্টমার কেয়ার টিমের সাথে যোগাযোগ করুন, আমরা আপনাকে সঠিক ফিট খুঁজে পেতে সাহায্য করব।"}
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
