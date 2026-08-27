"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import ProductEditor from "@/components/admin/ProductEditor";

export default function NewProductPage() {
  const router = useRouter();

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/dashboard/admin/products"
          className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-(--primary)"
        >
          <FiArrowLeft size={16} />
          Back to Products
        </Link>
      </div>
      <h1 className="mb-6 text-xl font-semibold text-neutral-900">New Product</h1>

      <ProductEditor
        productId={null}
        onCreated={() => router.push(`/dashboard/admin/products?page=1`)}
      />
    </div>
  );
}
