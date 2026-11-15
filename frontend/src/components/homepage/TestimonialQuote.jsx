/**
 * Featured customer quote — a single centered testimonial. Static content
 * for now.
 */
export default function TestimonialQuote() {
  return (
    <section className="w-full bg-background px-6 py-16 sm:px-8">
      <figure className="mx-auto max-w-3xl text-center">
        <blockquote className="text-lg leading-relaxed text-neutral-800 sm:text-xl">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad
          minim veniam, quis nostrud exercitation ullamco laboris nisi ut
          aliquip ex ea commodo consequat.
        </blockquote>
        <figcaption className="mt-4 text-xs tracking-wide text-neutral-500">
          — Lorem Ipsum
        </figcaption>
      </figure>
    </section>
  );
}
