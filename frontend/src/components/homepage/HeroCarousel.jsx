"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectFade, Navigation, Pagination } from "swiper/modules";

import HeroSlide from "./HeroSlide";

export default function HeroCarousel({ banners, autoplayDelayMs = 5000 }) {
  const delay = Math.min(15000, Math.max(2000, Number(autoplayDelayMs) || 5000));

  return (
    <section className="relative left-1/2 right-1/2 mx-[-50vw] h-screen min-h-150 w-screen overflow-hidden bg-neutral-900 sm:min-h-145">
      <Swiper
        modules={[Autoplay, EffectFade, Navigation, Pagination]}
        effect="fade"
        fadeEffect={{ crossFade: true }}
        speed={900}
        loop
        autoplay={{ delay, disableOnInteraction: false, pauseOnMouseEnter: true }}
        navigation
        pagination={{ clickable: true }}
        className="hero-swiper h-full w-full"
      >
        {banners.map((banner, index) => (
          <SwiperSlide key={banner.id} className="h-full">
            <HeroSlide banner={banner} priority={index === 0} />
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
