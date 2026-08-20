import Banner from "@/components/homepage/Banner";
import CampaignBanner from "@/components/homepage/CampaignBanner";
import CategoryShowcase from "@/components/homepage/CategoryShowcase";
import NewArrivals from "@/components/homepage/NewArrivals";

export default function Home() {
  return (
  <div className="">
    <Banner />
    <CategoryShowcase />
    <CampaignBanner />
    <NewArrivals />
  </div>
  );
}
