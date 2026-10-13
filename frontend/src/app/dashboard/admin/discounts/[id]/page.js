"use client";

import { useParams } from "next/navigation";
import DiscountEditor from "@/components/admin/DiscountEditor";

export default function EditDiscountPage() {
  const { id } = useParams();
  return <DiscountEditor discountId={id} />;
}
