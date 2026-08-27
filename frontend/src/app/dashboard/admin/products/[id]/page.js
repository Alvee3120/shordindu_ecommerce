"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";
import ProductEditor from "@/components/admin/ProductEditor";

export default function EditProductPage() {
  const { id } = useParams();
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
      <h1 className="mb-6 text-xl font-semibold text-neutral-900">Edit Product</h1>

      <ProductEditor
        productId={Number(id)}
        onSaved={() => router.push(`/dashboard/admin/products?page=1`)}
      />
    </div>
  );
}
