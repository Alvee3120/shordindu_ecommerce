"use client";

import { useState } from "react";

const content = {
  en: {
    intro: `We want you to love what you have ordered, but if something isn't right, let us know. On that item, we'll give you a refund in a different color, a different size, or a completely alternative style. In the unlikely event that any merchandise you have ordered from us does not meet your expectations or is not received in good condition, is damaged or defective, or if the merchandise delivered differs from what you had ordered, you may return the merchandise in any of our outlets for an exchange within 30 days of the date these goods are delivered, as long as it is unused and in the same condition as you received it, in its original packaging with original tags. Once received, the outlet staff will check to determine whether all requirements have been completed before processing your exchange.`,
    sections: [
      {
        heading: "Note",
        list: [
          "Products cannot be exchanged after 30 days of delivery. It can only be returned or exchanged for other goods.",
          "Items will only be taken into consideration for store exchange if they are brand new and have all of their tags attached. It's possible that soiled or damaged returns won't be accepted and will instead be sent back to the client. If any goods or products are delivered without tags, kindly let our customer care staff know.",
          "Custom orders cannot be canceled or returned.",
        ],
      },
      {
        heading: "For Online",
        list: [
          "The customer must inspect the requested goods (Color, size, number, and quality) in front of the delivery person before making a complaint.",
          "If the goods have a problem, the customer must return them to the delivery person right away.",
          "If the client raises any issues with the delivery person while accepting the order, replacement, return, or refund options will be available.",
          "To receive a replacement, the customer must carefully maintain the original invoice and tags.",
          "The value of the exchanged clothing must match or exceed the original invoice.",
          "We retain the only right to judge whether the products have been used, altered, or damaged.",
          "Orders can be canceled within 24 hours of placement. Please contact our customer care staff to initiate the cancellation process.",
          "If the cancellation request is made after the 24-hour window, we cannot guarantee that the order can be canceled, as it might have already been processed or shipped.",
          "If the order has not been shipped and the cancellation is approved, a refund will be processed according to our refund policy.",
        ],
      },
      {
        heading: "Refund Policy for Online",
        subheading: "(In Specific Scenario Only)",
        list: [
          "If we are unable to deliver your desired products. But it will not apply to out-of-stock products.",
          "Custom orders cannot be canceled once they have been placed, as they are specially made according to your preferences.",
        ],
      },
      {
        heading: "For Outlet",
        list: [
          "Within 30 days of purchasing from one of our Outlets, the customer may exchange unworn and unaltered clothing.",
          "To receive a replacement, the customer must carefully maintain the original invoice and tags.",
          "The value of the exchanged clothing must match or exceed the original invoice.",
          "We retain the only right to judge whether the products have been used, altered, or damaged.",
          "Orders placed at our outlets can be canceled on the same day of purchase. Please visit the outlet where the purchase was made and present the original invoice to request a cancellation.",
          "Once the item has left the outlet premises or after the cancellation window, cancellations might not be possible.",
        ],
      },
    ],
  },
  bn: {
    intro: `আমরা চাই আপনি যা আদেশ করেছেন তা আপনি পছন্দ করুন, কিন্তু যদি কিছু সঠিক না হয়, আমাদের জানান। সেই আইটেমে, আমরা আপনাকে একটি ভিন্ন রঙে, একটি ভিন্ন আকারে বা সম্পূর্ণ বিকল্প শৈলীতে অর্থ ফেরত দেব। অসম্ভাব্য ঘটনা যে আপনি আমাদের কাছ থেকে অর্ডার করেছেন এমন কোনও পণ্যদ্রব্য আপনার প্রত্যাশা পূরণ করে না বা ভাল অবস্থায় পাওয়া যায় না, ক্ষতিগ্রস্থ বা ত্রুটিপূর্ণ হয়, বা যদি সরবরাহকৃত পণ্যদ্রব্য আপনার অর্ডারের থেকে ভিন্ন হয়, আপনি যে কোনও একটিতে পণ্যদ্রব্য ফেরত দিতে পারেন। আমাদের আউটলেটগুলি এই পণ্যগুলি সরবরাহ করার তারিখের ৩০ দিনের মধ্যে বিনিময়ের জন্য, যতক্ষণ না এটি অব্যবহৃত থাকে এবং আপনি যে অবস্থায় এটি পেয়েছেন একই অবস্থায়, আসল ট্যাগ সহ এর আসল প্যাকেজিংয়ে। একবার প্রাপ্ত হলে, আউটলেট কর্মীরা আপনার এক্সচেঞ্জ প্রক্রিয়া করার আগে সমস্ত প্রয়োজনীয়তা সম্পন্ন হয়েছে কিনা তা নির্ধারণ করতে পরীক্ষা করবে।`,
    sections: [
      {
        heading: "বিঃদ্রঃ",
        list: [
          "৩০ দিন পর পণ্য বিনিময় করা যাবে না। এটি শুধুমাত্র ফেরত বা অন্যান্য পণ্যের বিনিময় করা যেতে পারে।",
          "আইটেমগুলি শুধুমাত্র স্টোর এক্সচেঞ্জের জন্য বিবেচনা করা হবে যদি সেগুলি একেবারে নতুন হয় এবং তাদের সমস্ত ট্যাগ সংযুক্ত থাকে। এটা সম্ভব যে নোংরা বা ক্ষতিগ্রস্ত রিটার্ন গ্রহণ করা হবে না এবং পরিবর্তে ক্লায়েন্টের কাছে ফেরত পাঠানো হবে। যদি কোনো পণ্য বা পণ্য ট্যাগ ছাড়া বিতরণ করা হয়, দয়া করে আমাদের গ্রাহক যত্ন কর্মীদের জানান।",
          "কাস্টম অর্ডার বাতিল বা ফেরত যাবে না।",
        ],
      },
      {
        heading: "অনলাইনের জন্য",
        list: [
          "অভিযোগ করার আগে গ্রাহককে অবশ্যই ডেলিভারি ব্যক্তির সামনে অনুরোধ করা পণ্যগুলি (রঙ, আকার, সংখ্যা এবং গুণমান) পরীক্ষা করতে হবে।",
          "যদি পণ্যগুলির কোনও সমস্যা হয়, গ্রাহককে অবশ্যই সেগুলি ডেলিভারি ব্যক্তির কাছে ফেরত দিতে হবে।",
          "ক্লায়েন্ট অর্ডার গ্রহণ করার সময় ডেলিভারি ব্যক্তির সাথে কোনো সমস্যা উত্থাপন করলে, প্রতিস্থাপন, রিটার্ন, বা রিফান্ড বিকল্পগুলি উপলব্ধ হবে।",
          "একটি প্রতিস্থাপন পেতে, গ্রাহককে সাবধানে মূল চালান এবং ট্যাগ বজায় রাখতে হবে।",
          "বিনিময় করা পোশাকের মূল্য অবশ্যই আসল চালানের সাথে মিলবে বা তার বেশি হবে।",
          "পণ্যগুলি ব্যবহার করা হয়েছে, পরিবর্তিত হয়েছে বা ক্ষতিগ্রস্ত হয়েছে কিনা তা বিচার করার একমাত্র অধিকার আমাদের আছে।",
          "অর্ডার প্লেসমেন্ট ২৪ ঘন্টার মধ্যে বাতিল করা যেতে পারে। বাতিলকরণ প্রক্রিয়া শুরু করতে দয়া করে আমাদের কাস্টমার কেয়ার কর্মীদের সাথে যোগাযোগ করুন।",
          "যদি ২৪-ঘন্টা উইন্ডোর পরে বাতিলকরণের অনুরোধ করা হয়, আমরা নিশ্চয়তা দিতে পারি না যে অর্ডারটি বাতিল করা যেতে পারে, কারণ এটি ইতিমধ্যে প্রক্রিয়া করা বা পাঠানো হয়েছে।",
          "যদি অর্ডারটি পাঠানো না হয় এবং বাতিলকরণ অনুমোদিত হয়, তবে আমাদের ফেরত নীতি অনুযায়ী একটি ফেরত প্রক্রিয়া করা হবে।",
        ],
      },
      {
        heading: "অনলাইনের জন্য অর্থ ফেরত নীতি",
        subheading: "(শুধুমাত্র নির্দিষ্ট পরিস্থিতিতে)",
        list: [
          "আমরা যদি আপনার কাঙ্খিত পণ্য সরবরাহ করতে না পারি। তবে স্টক-এর বাইরে থাকা পণ্যের ক্ষেত্রে এটি প্রযোজ্য হবে না।",
          "কাস্টম অর্ডারগুলি একবার স্থাপন করার পরে বাতিল করা যাবে না, কারণ সেগুলি বিশেষভাবে আপনার পছন্দ অনুসারে তৈরি করা হয়।",
        ],
      },
      {
        heading: "আউটলেটের জন্য",
        list: [
          "আমাদের আউটলেটগুলির একটি থেকে কেনার ৩০ দিনের মধ্যে, গ্রাহক অপরিবর্তিত এবং অপরিবর্তিত পোশাক বিনিময় করতে পারেন।",
          "একটি প্রতিস্থাপন পেতে, গ্রাহককে সাবধানে মূল চালান এবং ট্যাগ বজায় রাখতে হবে।",
          "বিনিময় করা পোশাকের মূল্য অবশ্যই আসল চালানের সাথে মিলবে বা তার বেশি হবে।",
          "পণ্যগুলি ব্যবহার করা হয়েছে, পরিবর্তিত হয়েছে বা ক্ষতিগ্রস্ত হয়েছে কিনা তা বিচার করার একমাত্র অধিকার আমাদের আছে।",
          "আমাদের আউটলেটে দেওয়া অর্ডার ক্রয়ের একই দিনে বাতিল করা যেতে পারে। অনুগ্রহ করে সেই আউটলেটে যান যেখানে কেনাকাটা করা হয়েছিল এবং বাতিলের অনুরোধ করতে আসল চালানটি উপস্থাপন করুন।",
          "একবার আইটেমটি আউটলেট প্রাঙ্গণ ছেড়ে চলে গেলে বা বাতিলকরণ উইন্ডোর পরে, বাতিলকরণ সম্ভব নাও হতে পারে।",
        ],
      },
    ],
  },
};

export default function ReturnExchangePolicyPage() {
  const [lang, setLang] = useState("en");
  const data = content[lang];

  return (
    <main className=" text-(--primary)">
      {/* Header */}
      <section className="relative overflow-hidden border-b border-black/10 px-6 pt-32 pb-16 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="font-sora text-xs font-semibold tracking-widest text-black/40">
              LEGAL
            </p>

            {/* Language toggle */}
            <div className="flex items-center gap-1 rounded-full border border-black/10 bg-black/5 p-1">
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  lang === "en"
                    ? "bg-(--primary) text-white"
                    : "text-black/50 hover:text-black"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang("bn")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  lang === "bn"
                    ? "bg-(--primary) text-white"
                    : "text-black/50 hover:text-black"
                }`}
              >
                বাংলা
              </button>
            </div>
          </div>

          <h1 className={`${lang === "en" ? "font-sora" : "font-bangla"} text-4xl font-extrabold sm:text-5xl`}>
            {lang === "en"
              ? "Return, Exchange & Cancellation Policy"
              : "রিটার্ন, বিনিময় এবং বাতিলকরণ নীতি"}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-black/50">
            {data.intro}
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="px-6 py-16 sm:px-8">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 lg:grid-cols-[220px_1fr]">
          {/* Sticky in-page nav (desktop) */}
          <nav className="hidden lg:block">
            <div className="sticky top-28 flex flex-col gap-2">
              <p className="mb-2 text-xs font-semibold tracking-widest text-black/30">
                {lang === "en" ? "ON THIS PAGE" : "এই পাতায়"}
              </p>
              {data.sections.map((section) => (
                <a
                  key={section.heading}
                  href={`#${slugify(section.heading)}`}
                  className="text-sm text-black/50 transition-colors hover:text-black"
                >
                  {section.heading}
                </a>
              ))}
            </div>
          </nav>

          {/* Content */}
          <div
            className="flex flex-col gap-14"
            lang={lang === "bn" ? "bn" : "en"}
          >
            {data.sections.map((section) => (
              <article key={section.heading} id={slugify(section.heading)}>
              <h2 className={`${lang === "en" ? "font-sora" : "font-bangla"} mb-1 text-2xl font-bold sm:text-[28px]`}>
                  {section.heading}
                </h2>
                {section.subheading && (
                  <p className="mb-4 text-sm text-black/40">
                    {section.subheading}
                  </p>
                )}
                {!section.subheading && <div className="mb-4" />}

                <ol className="flex flex-col gap-3">
                  {section.list.map((item, i) => (
                    <li
                      key={i}
                      className="flex gap-3 text-[15px] leading-relaxed text-black/60"
                    >
                      <span className="font-sora shrink-0 text-black/30">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
              </article>
            ))}

            {/* Contact callout */}
            <div className="rounded-2xl border border-black/10 bg-black/[0.03] p-6 sm:p-8">
              <h3 className="font-sora mb-2 text-lg font-bold">
                {lang === "en"
                  ? "Need help with a return or exchange?"
                  : "রিটার্ন বা বিনিময় নিয়ে সাহায্য প্রয়োজন?"}
              </h3>
              <p className="mb-4 text-sm leading-relaxed text-black/50">
                {lang === "en"
                  ? "Contact our customer care team to start the process."
                  : "প্রক্রিয়া শুরু করতে আমাদের কাস্টমার কেয়ার টিমের সাথে যোগাযোগ করুন।"}
              </p>
              <a
                href="tel:+8801935600400"
                className="text-sm font-medium text-black underline underline-offset-4 hover:text-black/80"
              >
                +880 1935 600 400
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\u0980-\u09FF]+/g, "-")
    .replace(/(^-|-$)/g, "");
}