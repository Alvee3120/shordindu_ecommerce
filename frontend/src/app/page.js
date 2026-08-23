import Banner from "@/components/homepage/Banner";
import CampaignBanner from "@/components/homepage/CampaignBanner";
import CategoryShowcase from "@/components/homepage/CategoryShowcase";
import NewArrivals from "@/components/homepage/NewArrivals";
import Saree from "@/components/homepage/Saree";
import Men from "@/components/homepage/Men";
import Bag from "@/components/homepage/Bag";
import CustomerReviews from "@/components/homepage/CustomerReviews";
import StoreLocator from "@/components/homepage/StoreLocator";

export default function Home() {
  return (
  <div className="">
    <Banner />
    <CategoryShowcase />
    <CampaignBanner />
    <NewArrivals />
    <Saree />
    <Men />
    <Bag />
    <StoreLocator />
    <CustomerReviews />
  </div>
  );
}
