import StoreLocator from "@/components/store/StoreLocator";

export const metadata = {
  title: "Store Locations | Shordindu",
  description: "Find your nearest Shordindu outlet and get directions.",
};

export default function StoreLocationsPage() {
  return (
    <main className="pt-20 text-(--primary)">
      <StoreLocator />
    </main>
  );
}
