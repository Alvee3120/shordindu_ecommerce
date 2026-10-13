import CampaignBannerView from "@/components/homepage/CampaignBannerView";
import { getActiveCampaignBanner } from "@/lib/campaignBanner";

/**
 * Homepage campaign banner. Content, images, link and schedule are managed
 * by admins at /dashboard/admin/campaign-banner. Rendered on the server, so
 * the banner arrives with the page (no loading flash or layout shift); when
 * it's disabled, out of schedule or the API is down, nothing is rendered.
 */
export default async function CampaignBanner() {
  const banner = await getActiveCampaignBanner();
  if (!banner) return null;
  return <CampaignBannerView banner={banner} priority />;
}
