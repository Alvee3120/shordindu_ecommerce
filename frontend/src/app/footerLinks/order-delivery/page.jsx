"use client";

import { useState } from "react";

const content = {
  en: {
    intro: `Here's how ordering and delivery works from the moment you place an order to the moment it arrives at your door.`,
    sections: [
      {
        heading: "Placing an Order",
        list: [
          "Add your desired products to the cart and proceed to checkout.",
          "Fill in your correct delivery address and a reachable phone number.",
          "Choose your preferred payment method — Cash on Delivery or online payment.",
          "You will receive an order confirmation once your order is placed.",
        ],
      },
      {
        heading: "Processing Time",
        list: [
          "Orders are processed within 1-2 business days after confirmation.",
          "Custom or made-to-order items may require additional processing time, which will be communicated at the time of order.",
        ],
      },
      {
        heading: "Delivery Time",
        list: [
          "Inside Dhaka: 2-3 business days.",
          "Outside Dhaka: 3-5 business days.",
          "Delivery times may vary during peak seasons or due to unforeseen circumstances.",
        ],
      },
      {
        heading: "Delivery Charges",
        list: [
          "Delivery charges are calculated at checkout based on your location.",
          "Free delivery may be offered on orders above a certain amount during promotional periods.",
        ],
      },
      {
        heading: "Tracking Your Order",
        list: [
          "You will receive updates on your order status via phone or SMS.",
          "For any queries about your order, please contact our customer care team.",
        ],
      },
    ],
  },
  bn: {
    intro: `আপনি অর্ডার করার মুহূর্ত থেকে শুরু করে আপনার দরজায় পৌঁছানো পর্যন্ত অর্ডার এবং ডেলিভারি প্রক্রিয়া কীভাবে কাজ করে তা এখানে দেওয়া হলো।`,
    sections: [
      {
        heading: "অর্ডার করা",
        list: [
          "আপনার পছন্দের পণ্যগুলো কার্টে যোগ করুন এবং চেকআউট করুন।",
          "আপনার সঠিক ডেলিভারি ঠিকানা এবং একটি যোগাযোগযোগ্য ফোন নম্বর দিন।",
          "আপনার পছন্দের পেমেন্ট পদ্ধতি বেছে নিন — ক্যাশ অন ডেলিভারি বা অনলাইন পেমেন্ট।",
          "অর্ডার সম্পন্ন হলে আপনি একটি নিশ্চিতকরণ বার্তা পাবেন।",
        ],
      },
      {
        heading: "প্রসেসিং সময়",
        list: [
          "অর্ডার নিশ্চিত হওয়ার ১-২ কার্যদিবসের মধ্যে প্রক্রিয়াকরণ করা হয়।",
          "কাস্টম বা বিশেষ অর্ডারে অতিরিক্ত সময় লাগতে পারে, যা অর্ডারের সময় জানিয়ে দেওয়া হবে।",
        ],
      },
      {
        heading: "ডেলিভারি সময়",
        list: [
          "ঢাকার ভিতরে: ২-৩ কার্যদিবস।",
          "ঢাকার বাইরে: ৩-৫ কার্যদিবস।",
          "উৎসবের মৌসুমে বা অনাকাঙ্ক্ষিত পরিস্থিতিতে ডেলিভারি সময় ভিন্ন হতে পারে।",
        ],
      },
      {
        heading: "ডেলিভারি চার্জ",
        list: [
          "ডেলিভারি চার্জ আপনার অবস্থানের উপর ভিত্তি করে চেকআউটে হিসাব করা হয়।",
          "প্রমোশনাল সময়ে নির্দিষ্ট পরিমাণের বেশি অর্ডারে ফ্রি ডেলিভারি দেওয়া হতে পারে।",
        ],
      },
      {
        heading: "অর্ডার ট্র্যাক করা",
        list: [
          "আপনার অর্ডারের অবস্থা সম্পর্কে ফোন বা এসএমএস-এর মাধ্যমে আপডেট পাবেন।",
          "আপনার অর্ডার সম্পর্কে কোনো প্রশ্ন থাকলে আমাদের কাস্টমার কেয়ার টিমের সাথে যোগাযোগ করুন।",
        ],
      },
    ],
  },
};

export default function OrderDeliveryPage() {
  const [lang, setLang] = useState("en");
  const data = content[lang];

  return (
    <main className="text-(--primary)">
      <section className="relative overflow-hidden border-b border-black/10 px-6 pt-32 pb-16 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="font-sora text-xs font-semibold tracking-widest text-black/40">
              SHIPPING
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
            {lang === "en" ? "Shipping & Delivery" : "শিপিং ও ডেলিভারি"}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-black/50">{data.intro}</p>
        </div>
      </section>

      <section className="px-6 py-16 sm:px-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-14" lang={lang === "bn" ? "bn" : "en"}>
          {data.sections.map((section) => (
            <article key={section.heading}>
              <h2 className={`${lang === "en" ? "font-sora" : "font-bangla"} mb-4 text-2xl font-bold sm:text-[28px]`}>
                {section.heading}
              </h2>
              <ol className="flex flex-col gap-3">
                {section.list.map((item, i) => (
                  <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-black/60">
                    <span className="font-sora shrink-0 text-black/30">{String(i + 1).padStart(2, "0")}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </article>
          ))}

          <div className="rounded-2xl border border-black/10 bg-black/[0.03] p-6 sm:p-8">
            <h3 className="font-sora mb-2 text-lg font-bold">
              {lang === "en" ? "Questions about your delivery?" : "আপনার ডেলিভারি নিয়ে প্রশ্ন?"}
            </h3>
            <p className="mb-4 text-sm leading-relaxed text-black/50">
              {lang === "en"
                ? "Contact our customer care team and we'll help you track your order."
                : "আমাদের কাস্টমার কেয়ার টিমের সাথে যোগাযোগ করুন, আমরা আপনার অর্ডার ট্র্যাক করতে সাহায্য করব।"}
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
