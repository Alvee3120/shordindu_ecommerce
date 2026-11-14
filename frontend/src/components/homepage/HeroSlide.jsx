import Image from "next/image";
import Link from "next/link";

const ALIGNMENT = {
  left: { text: "text-left", block: "mr-auto" },
  center: { text: "text-center", block: "mx-auto" },
  right: { text: "text-right", block: "ml-auto" },
};

function isExternal(url) {
  return /^https?:\/\//i.test(url || "");
}

function HeroButton({ banner, preview }) {
  const outline = banner.button_style === "outline";
  const style = {
    borderRadius: `${Number(banner.button_radius) || 0}px`,
    ...(outline
      ? {
          border: `2px solid ${banner.button_background_color}`,
          color: banner.button_text_color,
          backgroundColor: "transparent",
        }
      : {
          backgroundColor: banner.button_background_color,
          color: banner.button_text_color,
        }),
  };
  const className = `inline-block ${
    preview ? "px-4 py-2 text-xs" : "px-6 py-3 text-sm"
  } font-semibold tracking-wide uppercase transition-transform hover:scale-105`;

  if (isExternal(banner.button_link)) {
    return (
      <a
        href={banner.button_link}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={style}
      >
        {banner.button_text}
      </a>
    );
  }
  return (
    <Link href={banner.button_link || "/"} className={className} style={style}>
      {banner.button_text}
    </Link>
  );
}

/**
 * One homepage hero slide. Shared by the public carousel and the admin
 * editor preview so both render the exact same thing.
 */
export default function HeroSlide({ banner, priority = false, preview = false }) {
  const desktop = banner.desktop_image_url || null;
  const mobile = banner.mobile_image_url || desktop;
  const align = ALIGNMENT[banner.text_alignment] || ALIGNMENT.left;
  const alt = banner.image_alt || banner.bold_heading || "Hero banner";
  const HeadingTag = priority ? "h1" : "h2";
  const showText = banner.show_text && (banner.bold_heading || banner.normal_heading);
  const showButton = banner.show_button && banner.button_text && banner.button_link;

  return (
    <div className="relative h-full w-full overflow-hidden bg-neutral-900">
      <div className="absolute inset-0 hidden sm:block">
        {desktop && (
          <Image
            src={desktop}
            alt={alt}
            fill
            priority={priority}
            sizes="100vw"
            unoptimized={desktop.startsWith("blob:")}
            className="object-cover object-center"
          />
        )}
      </div>
      <div className="absolute inset-0 block sm:hidden">
        {mobile && (
          <Image
            src={mobile}
            alt={alt}
            fill
            priority={priority}
            sizes="100vw"
            unoptimized={mobile.startsWith("blob:")}
            className="object-cover object-[70%_center]"
          />
        )}
      </div>

      <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-transparent" />

      <div
        className={`relative z-10 flex h-full items-end ${
          preview ? "px-6 pb-10" : "px-6 pb-20 sm:px-10 sm:pb-24"
        }`}
      >
        <div className={`mx-auto w-full ${preview ? "max-w-5xl" : "max-w-7xl"}`}>
          <div className={`max-w-2xl ${align.block} ${align.text}`}>
            {showText && (
              <>
                {banner.normal_heading && (
                  <p
                    className={`font-sora font-semibold uppercase tracking-[0.2em] ${
                      preview ? "mb-2 text-[10px]" : "mb-3 text-xs sm:text-sm"
                    }`}
                    style={{ color: banner.text_color }}
                  >
                    {banner.normal_heading}
                  </p>
                )}
                {banner.bold_heading && (
                  <HeadingTag
                    className={`font-sora font-extrabold tracking-tight ${
                      preview
                        ? "text-3xl leading-[1.05]"
                        : "text-4xl leading-[1.05] sm:text-5xl lg:text-6xl"
                    }`}
                    style={{ color: banner.text_color }}
                  >
                    {banner.bold_heading}
                  </HeadingTag>
                )}
              </>
            )}

            {showButton && (
              <div className={`${showText ? (preview ? "mt-4" : "mt-6") : "mt-0"} ${align.text}`}>
                <HeroButton banner={banner} preview={preview} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
