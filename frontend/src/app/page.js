import Banner from "@/components/homepage/Banner";
import CampaignBanner from "@/components/homepage/CampaignBanner";
import CategoryShowcase from "@/components/homepage/CategoryShowcase";
import NewArrivals from "@/components/homepage/NewArrivals";
import Saree from "@/components/homepage/Saree";
import Men from "@/components/homepage/Men";
import Bag from "@/components/homepage/Bag";
import DiscountShowcases from "@/components/homepage/DiscountShowcases";
import CustomerReviews from "@/components/homepage/CustomerReviews";
import StoreLocator from "@/components/homepage/StoreLocator";

export default function Home() {
  return (
  <div className="">
    <Banner />
    <CategoryShowcase />
    {/* One section per live automatic discount (admin-managed). */}
    <DiscountShowcases />
    <NewArrivals />
    <Saree />
    <CampaignBanner />
    <Men />
    <Bag />
    <StoreLocator />
    <CustomerReviews />
  </div>
  );
}
