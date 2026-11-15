import CampaignBannerView from "@/components/homepage/CampaignBannerView";
import { getActiveCampaignBanners } from "@/lib/campaignBanner";

/**
 * One homepage campaign banner slot. Content, images, link and schedule are
 * managed by admins at /dashboard/admin/campaign-banner. Rendered on the
 * server, so the banner arrives with the page (no loading flash or layout
 * shift); when that slot is disabled, out of schedule or the API is down,
 * nothing is rendered.
 */
export default async function CampaignBanner({ slot = 1 }) {
  const banners = await getActiveCampaignBanners();
  const banner = banners.find((item) => Number(item.slot) === Number(slot));
  if (!banner) return null;
  return <CampaignBannerView banner={banner} priority />;
}
