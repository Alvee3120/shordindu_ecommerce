"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";

export default function MainDashboardLayout({ children }) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.replace("/auth/login");
        }
    }, [user, loading, router]);

    if (loading || !user) {
        return (
            <div className="pt-15">
                <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row">
                    <aside className="w-full shrink-0 animate-pulse lg:w-64">
                        <div className="mb-6 space-y-2">
                            <div className="h-3 w-20 rounded bg-neutral-200" />
                            <div className="h-4 w-32 rounded bg-neutral-200" />
                            <div className="h-3 w-40 rounded bg-neutral-200" />
                        </div>
                        <div className="space-y-2">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-9 rounded-lg bg-neutral-100" />
                            ))}
                        </div>
                    </aside>
                    <div className="min-w-0 flex-1 animate-pulse space-y-6">
                        <div className="space-y-2">
                            <div className="h-5 w-56 rounded bg-neutral-200" />
                            <div className="h-3 w-72 rounded bg-neutral-100" />
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="h-28 rounded-xl border border-neutral-200 bg-neutral-100" />
                            ))}
                        </div>
                        <div className="h-48 rounded-xl border border-neutral-200 bg-neutral-100" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="pt-15">
            <DashboardLayout userRole={user?.role}>
                {children}
            </DashboardLayout>
        </div>
    );
}