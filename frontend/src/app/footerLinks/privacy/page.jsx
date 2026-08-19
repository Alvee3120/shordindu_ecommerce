export const metadata = {
  title: "Privacy Policy | Shordindu",
  description: "How Shordindu collects, uses, and protects your personal information.",
};

const sections = [
  {
    heading: "Collection of Personal Information",
    content: [
      `As a visitor to the Site, you can visit and enjoy our site without providing any Personal Information. Some of the information we ask you to provide is required by law, while other information is up to you. If you do not provide mandatory data about a particular activity, you will not be able to participate in that activity.`,
      `However, when you register to use Shordindu and order products as a Shordindu customer, in order to provide you with services, we may collect your contact information, such as your name, phone number, address and email address and profile information, including your password, details of your purchases and details of your interactions with us.`,
    ],
  },
  {
    heading: "Updating Personal Information",
    content: [
      `You have the right to access and correct, or delete your Personal Information and privacy preferences at any time. You can change most of your Personal Information by clicking on the link "My Account" in the menu on the right side of this page.`,
      `For security purposes, we can change certain Personal Information using contact support. We will respond to your request promptly within a reasonable time.`,
    ],
  },
  {
    heading: "How Your Personal Information is Used",
    content: [
      `Shordindu collects your information in order to provide you with services, to meet our legal obligations, and to improve our products and services. We do not sell, rent, or share your personal information with any third parties other than as disclosed in this privacy policy.`,
    ],
  },
  {
    heading: "Electronic Communication",
    content: [
      `When you communicate with us electronically, you are helping us to improve our site. You agree to receive communications from us electronically. You agree that all agreements, notices, disclosures and other communications that we provide to you electronically satisfy any legal requirement that such communications be in writing.`,
    ],
  },
  {
    heading: "Shordindu May Use This To",
    list: [
      "Respond to inquiries, queries, and concerns from customers.",
      "Take care of your account.",
      "Send you the product or service information you requested.",
      "Keep you updated on unique deals and services from carefully chosen third parties.",
      "Administer marketing and alert you about special occasions.",
      "To look into, stop, or do something about illegal activity and/or Terms of Service violations.",
    ],
  },
  {
    heading: "Security of Your Personal Information",
    content: [
      `The personal information you provide when using our website is protected by several means. The information is stored on secure servers that only a select few people have access to by password. Whenever your personal information (like your credit card number) is transmitted to Shordindu, it is encrypted using security technology.`,
      `We take great care to protect the personal information you provide to us, both when it's being transmitted to us and once we've received it. However, no method of transmitting or storing information over the Internet is 100% secure.`,
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className=" text-(--primary)">
      {/* Header */}
      <section className="relative overflow-hidden border-b border-black/10 px-6 pt-32 pb-16 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <p className="font-sora mb-3 text-xs font-semibold tracking-widest text-black/40">
            LEGAL
          </p>
          <h1 className="font-sora text-4xl font-extrabold sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-black/50">
            At Shordindu, we value your concerns about your privacy while
            browsing and shopping on our website. We take precautions to
            ensure that the information you provide will not be used
            inappropriately. This policy describes how we use and protect
            the personal information we collect from you, and may be
            modified from time to time.
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
                ON THIS PAGE
              </p>
              {sections.map((section) => (
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
          <div className="flex flex-col gap-14">
            {sections.map((section) => (
              <article key={section.heading} id={slugify(section.heading)}>
                <h2 className="font-sora mb-4 text-2xl font-bold sm:text-[28px]">
                  {section.heading}
                </h2>

                {section.content?.map((para, i) => (
                  <p
                    key={i}
                    className="mb-4 text-[15px] leading-relaxed text-black/60"
                  >
                    {para}
                  </p>
                ))}

                {section.list?.length > 0 && (
                  <ol className="flex flex-col gap-2">
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
                )}
              </article>
            ))}

            {/* Contact callout */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
              <h3 className="font-sora mb-2 text-lg font-bold">
                Questions about your privacy?
              </h3>
              <p className="mb-4 text-sm leading-relaxed text-black/50">
                If you have any questions about our privacy and security
                policy, please reach out — we're happy to help.
              </p>
              <a
                href="mailto:support@shordindu.com.bd"
                className="text-sm font-medium text-black underline underline-offset-4 hover:text-black/80"
              >
                support@shordindu.com.bd
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
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}