"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FiPackage,
  FiBox,
  FiGrid,
  FiSliders,
  FiLink2,
  FiTag,
  FiStar,
  FiArrowRight,
} from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";
import ProfileFields from "@/components/dashboard/ProfileFields";
import { listOrders } from "@/lib/orders";
import { listProducts } from "@/lib/products";
import { getCategories } from "@/lib/categories";
import { listCoupons } from "@/lib/coupons";
import { listReviews } from "@/lib/reviews";

const sections = [
  { label: "Orders", href: "/dashboard/admin/orders", icon: FiPackage, description: "Track and manage customer orders", statKey: "orders" },
  { label: "Products", href: "/dashboard/admin/products", icon: FiBox, description: "Add, edit, and organize products", statKey: "products" },
  { label: "Categories", href: "/dashboard/admin/categories", icon: FiGrid, description: "Manage product categories", statKey: "categories" },
  { label: "Attributes", href: "/dashboard/admin/attributes", icon: FiSliders, description: "Configure product attributes" },
  { label: "Product Addons", href: "/dashboard/admin/product-addons", icon: FiLink2, description: "Manage add-on products" },
  { label: "Coupons", href: "/dashboard/admin/coupons", icon: FiTag, description: "Create and manage discount coupons", statKey: "coupons" },
  { label: "Reviews", href: "/dashboard/admin/reviews", icon: FiStar, description: "Moderate customer reviews", statKey: "reviews" },
];

const statusColors = {
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [counts, setCounts] = useState({});
  const [recentOrders, setRecentOrders] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    Promise.allSettled([
      listOrders(),
      listProducts(),
      getCategories(),
      listCoupons(),
      listReviews(),
    ]).then(([orders, products, categories, coupons, reviews]) => {
      if (cancelled) return;

      setCounts({
        orders: orders.status === "fulfilled" ? orders.value.count : null,
        products: products.status === "fulfilled" ? products.value.count : null,
        categories:
          categories.status === "fulfilled"
            ? categories.value.count ?? categories.value.results?.length ?? categories.value.length
            : null,
        coupons: coupons.status === "fulfilled" ? coupons.value.length : null,
        reviews: reviews.status === "fulfilled" ? reviews.value.count : null,
      });

      setRecentOrders(orders.status === "fulfilled" ? orders.value.results.slice(0, 5) : []);
      setLoadingStats(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-neutral-900">
        Welcome back, {user.name}
      </h1>
      <p className="mb-8 text-sm text-neutral-500">
        Here&apos;s an overview of your store.
      </p>

      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map(({ label, href, icon: Icon, description, statKey }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 transition-colors hover:border-(--primary)/40 hover:bg-(--primary)/5"
          >
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--primary)/10 text-(--primary)">
                  <Icon size={18} />
                </div>
                {statKey && (
                  <span className="text-2xl font-semibold text-neutral-900">
                    {loadingStats ? "—" : counts[statKey] ?? "—"}
                  </span>
                )}
              </div>
              <h2 className="font-medium text-neutral-900">{label}</h2>
              <p className="mt-1 text-sm text-neutral-500">{description}</p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-sm font-medium text-(--primary) opacity-0 transition-opacity group-hover:opacity-100">
              Manage
              <FiArrowRight size={14} />
            </div>
          </Link>
        ))}
      </div>

      <div className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Recent Orders</h2>
          <Link
            href="/dashboard/admin/orders"
            className="text-sm font-medium text-(--primary) hover:underline"
          >
            View all
          </Link>
        </div>

        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-5 py-3 font-medium">Order</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Placed</th>
              </tr>
            </thead>
            <tbody>
              {loadingStats ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-neutral-500">
                    Loading...
                  </td>
                </tr>
              ) : recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-neutral-500">
                    No orders yet.
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-5 py-3 font-medium text-neutral-900">
                      <Link
                        href={`/dashboard/admin/orders/${order.id}`}
                        className="hover:text-(--primary) hover:underline"
                      >
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-neutral-600">
                      {order.guest_email || `User #${order.user ?? "—"}`}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                          statusColors[order.status] || "bg-neutral-100 text-neutral-600"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-neutral-900">৳{order.grand_total}</td>
                    <td className="px-5 py-3 text-neutral-500">
                      {new Date(order.placed_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="mb-4 text-lg font-semibold text-neutral-900">My Profile</h2>
      <ProfileFields user={user} />
    </div>
  );
}
