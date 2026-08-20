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
        return null;
    }

    return (
        <div className="pt-15">
            <DashboardLayout userRole={user?.role}>
                {children}
            </DashboardLayout>
        </div>
    );
}