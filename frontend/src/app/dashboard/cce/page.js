"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiArrowRight, FiPackage } from "react-icons/fi";

import ProfileFields from "@/components/dashboard/ProfileFields";
import { useAuth } from "@/context/AuthContext";
import { listOrders } from "@/lib/orders";

const statusColors = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-cyan-100 text-cyan-700",
  processing: "bg-blue-100 text-blue-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function CceDashboardPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [orderCount, setOrderCount] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listOrders()
      .then((data) => {
        if (cancelled) return;
        setOrders(data.results.slice(0, 5));
        setOrderCount(data.count);
      })
      .catch(() => {
        if (cancelled) return;
        setOrders([]);
        setOrderCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return <p className="text-sm text-neutral-500">Loading...</p>;

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-neutral-900">Welcome back, {user.name}</h1>
      <p className="mb-8 text-sm text-neutral-500">Manage and keep customers&apos; orders moving.</p>

      <Link href="/dashboard/cce/orders" className="group mb-10 flex max-w-md flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 transition-colors hover:border-(--primary)/40 hover:bg-(--primary)/5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--primary)/10 text-(--primary)"><FiPackage size={18} /></div>
          <span className="text-lg font-semibold text-neutral-900">{orderCount ?? "—"}</span>
        </div>
        <h2 className="font-medium text-neutral-900">Orders</h2>
        <p className="mt-1 text-sm text-neutral-500">Search, review, and update customer orders.</p>
        <span className="mt-4 flex items-center gap-1 text-sm font-medium text-(--primary)">Manage orders <FiArrowRight size={14} /></span>
      </Link>

      <div className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Recent Orders</h2>
          <Link href="/dashboard/cce/orders" className="text-sm font-medium text-(--primary) hover:underline">View all</Link>
        </div>
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-neutral-200 text-neutral-500"><th className="px-5 py-3 font-medium">Order</th><th className="px-5 py-3 font-medium">Customer</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Total</th></tr></thead>
            <tbody>
              {orders.length === 0 ? <tr><td colSpan={4} className="px-5 py-6 text-center text-neutral-500">No orders yet.</td></tr> : orders.map((order) => (
                <tr key={order.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-5 py-3 font-medium text-neutral-900"><Link href={`/dashboard/cce/orders/${order.id}`} className="hover:text-(--primary) hover:underline">{order.order_number}</Link></td>
                  <td className="px-5 py-3 text-neutral-600">{order.user_name || order.guest_email || "—"}</td>
                  <td className="px-5 py-3"><span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusColors[order.status] || "bg-neutral-100 text-neutral-600"}`}>{order.status}</span></td>
                  <td className="px-5 py-3 text-neutral-900">৳{order.grand_total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="mb-4 text-lg font-semibold text-neutral-900">My Profile</h2>
      <ProfileFields user={user} />
    </div>
  );
}
