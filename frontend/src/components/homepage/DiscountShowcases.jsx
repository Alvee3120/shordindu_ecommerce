import DiscountSection from "@/components/homepage/DiscountSection";
import { getDiscountShowcases } from "@/lib/discounts";
import { toCardProduct } from "@/lib/products";

/**
 * One homepage section per live automatic discount, titled with the name the
 * admin gave it and showing the products that discount currently prices.
 * Rendered on the server from a single API call; scheduled, expired,
 * switched-off and product-less discounts never appear. Uses the same
 * ProductShowcase / ProductCard as the category sections, plus a countdown.
 */
export default async function DiscountShowcases() {
  const sections = await getDiscountShowcases();
  if (sections.length === 0) return null;

  return sections.map((section) => (
    <DiscountSection key={section.id} section={section} products={section.products.map(toCardProduct)} />
  ));
}
