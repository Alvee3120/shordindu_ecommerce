import Image from "next/image";
import Link from "next/link";

const campaignImage = "/assets/banner/banner.jpeg";
const campaignImageMobile = "/assets/banner/bannerM.jpeg";
const campaignUrl = "https://shordindu.com.bd/product-category/mid-year-clearance-sale";

export default function CampaignBanner() {
  return (
    <section className="relative left-1/2 right-1/2 mx-[-50vw] flex h-[420px] w-screen items-center overflow-hidden bg-neutral-200 sm:h-[420px] lg:h-[560px]">
      {/* Background image */}
      <div className="hidden sm:block absolute inset-0 z-0">
        <Image
          src={campaignImage}
          alt="Mid Year Clearance Sale"
          fill
          priority
          className="object-cover object-center"
        />
      </div>
      <div className="block sm:hidden absolute inset-0 z-0">
        <Image
          src={campaignImageMobile}
          alt="Mid Year Clearance Sale"
          fill
          priority
          className="object-cover object-[75%_center]"
        />
      </div>

      {/* Left text content */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 sm:px-8">
        <div className="max-w-md">
          <p className="font-sora mb-3 text-xs font-semibold tracking-[0.2em] text-white/70 sm:text-sm">
            SEASONAL OFFER
          </p>

          <h2 className="font-sora mb-4 text-4xl leading-[1.05] font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Mid Year
            <br />
            Clearance
            <br />
            Sale
          </h2>

          <p className="mb-6 max-w-xs text-sm leading-relaxed text-white/70 sm:text-base">
            Up to 50% off on selected styles. Refresh your wardrobe before the
            season ends.
          </p>

          <Link
            href={campaignUrl}
            className="inline-block rounded-md bg-(--primary) transition-transform hover:scale-105 px-6 py-3 text-xs font-semibold tracking-wide text-white uppercase sm:text-sm"
          >
            Explore Collection
          </Link>
        </div>
      </div>
    </section>
  );
}