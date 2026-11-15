import Image from "next/image";

/**
 * Brand statement: a full-bleed split section — campaign image on one side,
 * a black panel with a large statement on the other. Static content for now.
 */
export default function BrandStatement() {
  return (
    <section className="mt-16 grid w-full grid-cols-1 md:grid-cols-2">
      <div className="relative aspect-[4/3] w-full md:aspect-auto md:min-h-[500px]">
        <Image
          src="/assets/banner/bannerD2.jpeg"
          alt="Shordindu campaign"
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover object-center"
        />
      </div>

      <div className="flex items-center bg-[#7D5449] px-6 py-14 sm:px-12 lg:px-16">
        <p className="font-sora max-w-xl text-3xl leading-[1.15] font-normal text-white sm:text-4xl lg:text-5xl">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua.
        </p>
      </div>
    </section>
  );
}
