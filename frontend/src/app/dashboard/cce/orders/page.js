"use client";

import Link from "next/link";
import { FiPlus } from "react-icons/fi";
import AdminOrdersTable from "@/components/admin/AdminOrdersTable";

export default function CceOrdersPage() {
  return (
    <AdminOrdersTable
      title="Orders"
      ordersPath="/dashboard/cce/orders"
      headerAction={
        <Link
          href="/dashboard/cce/orders/new"
          className="flex items-center gap-1.5 rounded-lg bg-(--primary) px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90"
        >
          <FiPlus size={15} />
          Add Order
        </Link>
      }
    />
  );
}
