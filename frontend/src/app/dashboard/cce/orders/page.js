"use client";

import AdminOrdersTable from "@/components/admin/AdminOrdersTable";

export default function CceOrdersPage() {
  return <AdminOrdersTable title="Orders" ordersPath="/dashboard/cce/orders" />;
}
