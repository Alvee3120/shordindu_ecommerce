import HeroCarousel from "@/components/homepage/HeroCarousel";
import HeroSlide from "@/components/homepage/HeroSlide";
import { getActiveHeroBanners } from "@/lib/heroBanners";

// Homepage hero: one active banner renders statically; two or three use the
// Swiper carousel. Content comes from the admin-managed hero banners.
export default async function Banner() {
  const { banners, autoplayDelayMs } = await getActiveHeroBanners();

  if (!banners.length) return null;

  if (banners.length === 1) {
    return (
      <section className="relative left-1/2 right-1/2 mx-[-50vw] h-screen min-h-150 w-screen overflow-hidden bg-neutral-900 sm:min-h-145">
        <HeroSlide banner={banners[0]} priority />
      </section>
    );
  }

  return <HeroCarousel banners={banners} autoplayDelayMs={autoplayDelayMs} />;
}
