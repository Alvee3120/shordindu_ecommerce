import DashboardLayout from "@/components/dashboard/DashboardLayout";


export default async function MainDashboardLayout({ children }) {

    return (
        <div className="pt-15">
            <DashboardLayout >
                {children}
            </DashboardLayout>
        </div>
    );
}