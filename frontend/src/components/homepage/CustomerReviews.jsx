"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Marquee from "react-fast-marquee";
import { FiStar } from "react-icons/fi";
import { listReviews } from "@/lib/reviews";

function ReviewCard({ review }) {
  const name = review.user_name || "Anonymous";
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="mx-3 flex w-95 shrink-0 flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex  gap-3">
        {review.image && (
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
            <Image src={review.image} alt={name} fill className="object-cover" sizes="80px" />
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-1 text-yellow-500">
            {Array.from({ length: 5 }).map((_, i) => (
              <FiStar key={i} size={16} fill={i < review.rating ? "currentColor" : "none"} />
            ))}
          </div>

          <p className="line-clamp-3 text-sm leading-relaxed text-neutral-700">
            &quot;{review.comment}&quot;
          </p>
        </div>
      </div>

      <div className="flex items-center justify-start gap-2 text-left">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-medium text-neutral-600">
          {initial}
        </span>
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-semibold text-neutral-900">{name}</p>
          {review.product_name && (
            <p className="truncate text-xs text-neutral-500">{review.product_name}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CustomerReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    listReviews({ status: "approved" })
      .then((data) => {
        if (cancelled) return;
        setReviews(data.results ?? data ?? []);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && reviews.length === 0) return null;

  const half = Math.ceil(reviews.length / 2);
  const row1 = reviews.slice(0, half);
  const row2 = reviews.slice(half);

  return (
    <section className="w-full bg-white px-6 py-16 sm:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-10 text-center">
          <span className="font-sora text-2xl font-medium text-(--primary)">
            What Our Customers Say
          </span>
        </div>

        {loading ? (
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-55 w-85 shrink-0 animate-pulse rounded-2xl bg-neutral-100"
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <Marquee direction="right" speed={40} pauseOnHover gradient={false}>
              {row1.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </Marquee>
            {row2.length > 0 && (
              <Marquee direction="left" speed={40} pauseOnHover gradient={false}>
                {row2.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </Marquee>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
