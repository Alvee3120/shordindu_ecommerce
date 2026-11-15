import Banner from "@/components/homepage/Banner";
import CampaignBanner from "@/components/homepage/CampaignBanner";
import CategoryShowcase from "@/components/homepage/CategoryShowcase";
import NewArrivals from "@/components/homepage/NewArrivals";
import Saree from "@/components/homepage/Saree";
import Men from "@/components/homepage/Men";
import Bag from "@/components/homepage/Bag";
import BrandStatement from "@/components/homepage/BrandStatement";
import TestimonialQuote from "@/components/homepage/TestimonialQuote";
import DiscountShowcases from "@/components/homepage/DiscountShowcases";
import CustomerReviews from "@/components/homepage/CustomerReviews";

export default function Home() {
  return (
    <div className="">
      <Banner />
      <CategoryShowcase />
      {/* Admin-managed campaign banners (/dashboard/admin/campaign-banner). */}
      <CampaignBanner slot={1} />
      {/* One section per live automatic discount (admin-managed). */}
      <DiscountShowcases />
      <NewArrivals />
      <Saree />
      <CampaignBanner slot={2} />
      <Men />
      <Bag />
      {/* <CustomerReviews /> */}
      <BrandStatement />
      <TestimonialQuote />
    </div>
  );
}
