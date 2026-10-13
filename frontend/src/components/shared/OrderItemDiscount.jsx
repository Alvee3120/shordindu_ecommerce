/**
 * The automatic discount an order line was placed with — read from the
 * order's own snapshot (original_unit_price / discount_name_snapshot), so it
 * never changes when the discount or product is edited later.
 */
export default function OrderItemDiscount({ item }) {
  if (!item.original_unit_price) return null;
  return (
    <p className="text-xs text-emerald-700">
      <span className="text-neutral-400 line-through">৳{item.original_unit_price}</span>{" "}
      {item.discount_name_snapshot || "Discount"} applied
    </p>
  );
}
