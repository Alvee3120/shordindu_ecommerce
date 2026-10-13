import Image from "next/image";
import Link from "next/link";

/**
 * Pure presentation for the campaign banner — shared by the homepage
 * (server-rendered) and the admin preview, so both always look the same.
 *
 * `banner`: the API shape (image_mode, desktop_image_url, mobile_image_url,
 * image_alt, eyebrow, heading, description, button_*).
 * `variant`: "responsive" (real site: switches at the sm breakpoint), or
 * "desktop" / "mobile" to force one layout for the admin preview.
 * `contained`: render inside its parent instead of full-bleed (preview).
 */

const STYLES = {
  responsive: {
    height: "h-[420px] sm:h-[420px] lg:h-[560px]",
    padding: "px-6 sm:px-8",
    eyebrow: "text-xs sm:text-sm",
    heading: "text-4xl sm:text-5xl lg:text-6xl",
    description: "text-sm sm:text-base",
    button: "text-xs sm:text-sm",
    desktopLayer: "hidden sm:block",
    mobileLayer: "block sm:hidden",
  },
  desktop: {
    height: "h-[560px]",
    padding: "px-8",
    eyebrow: "text-sm",
    heading: "text-6xl",
    description: "text-base",
    button: "text-sm",
    desktopLayer: "block",
    mobileLayer: "hidden",
  },
  mobile: {
    height: "h-[420px]",
    padding: "px-6",
    eyebrow: "text-xs",
    heading: "text-4xl",
    description: "text-sm",
    button: "text-xs",
    desktopLayer: "hidden",
    mobileLayer: "block",
  },
};

/** Which image each screen size gets, per the admin's display mode. */
export function resolveBannerImages(banner) {
  const desktop = banner.desktop_image_url || null;
  const mobile = banner.mobile_image_url || null;
  if (banner.image_mode === "desktop") return { desktop, mobile: desktop };
  if (banner.image_mode === "mobile") return { desktop: mobile || desktop, mobile: mobile || desktop };
  return { desktop, mobile: mobile || desktop }; // responsive: mobile falls back to desktop
}

function isExternal(url) {
  return /^https?:\/\//i.test(url);
}

function BannerImage({ src, alt, className, priority }) {
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes="100vw"
      // Local previews (blob: URLs of not-yet-uploaded files) can't go through the optimizer.
      unoptimized={src.startsWith("blob:")}
      className={className}
    />
  );
}

export default function CampaignBannerView({ banner, variant = "responsive", contained = false, priority = false }) {
  const s = STYLES[variant] ?? STYLES.responsive;
  const images = resolveBannerImages(banner);
  const headingLines = (banner.heading || "").split("\n").filter((line) => line.trim());
  const alt = banner.image_alt || headingLines.join(" ");
  const showButton = banner.button_enabled && banner.button_label && banner.button_url;
  const buttonClass = `inline-block rounded-md bg-(--primary) transition-transform hover:scale-105 px-6 py-3 ${s.button} font-semibold tracking-wide text-white uppercase`;

  return (
    <section
      aria-label={alt || "Campaign"}
      className={`relative flex ${s.height} items-center overflow-hidden bg-neutral-200 ${
        contained ? "w-full" : "left-1/2 right-1/2 mx-[-50vw] w-screen"
      }`}
    >
      {/* Background image — only one layer is visible per screen size */}
      <div className={`${s.desktopLayer} absolute inset-0 z-0`}>
        <BannerImage src={images.desktop} alt={alt} priority={priority} className="object-cover object-center" />
      </div>
      <div className={`${s.mobileLayer} absolute inset-0 z-0`}>
        <BannerImage src={images.mobile} alt={alt} priority={priority} className="object-cover object-[75%_center]" />
      </div>

      {/* Left text content */}
      <div className={`relative z-10 mx-auto w-full max-w-7xl ${s.padding}`}>
        <div className="max-w-md">
          {banner.eyebrow && (
            <p className={`font-sora mb-3 ${s.eyebrow} font-semibold tracking-[0.2em] text-white/70`}>
              {banner.eyebrow}
            </p>
          )}

          <h2 className={`font-sora mb-4 ${s.heading} leading-[1.05] font-extrabold tracking-tight text-white`}>
            {headingLines.map((line, index) => (
              <span key={index}>
                {index > 0 && <br />}
                {line}
              </span>
            ))}
          </h2>

          {banner.description && (
            <p className={`mb-6 max-w-xs ${s.description} leading-relaxed whitespace-pre-line text-white/70`}>
              {banner.description}
            </p>
          )}

          {showButton &&
            (isExternal(banner.button_url) ? (
              <a href={banner.button_url} target="_blank" rel="noopener noreferrer" className={buttonClass}>
                {banner.button_label}
              </a>
            ) : (
              <Link href={banner.button_url} className={buttonClass}>
                {banner.button_label}
              </Link>
            ))}
        </div>
      </div>
    </section>
  );
}
