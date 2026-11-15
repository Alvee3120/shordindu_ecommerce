import { getActiveAnnouncement } from "@/lib/announcementBar";
import AnnouncementBarText from "@/components/shared/AnnouncementBarText";

/**
 * Site-wide announcement strip shown at the top of the header. Text and colours
 * are managed by admins at /dashboard/admin/announcement-bar. Rendered on the
 * server; when it's disabled or empty, nothing is rendered.
 */
export default async function AnnouncementBar() {
  const announcement = await getActiveAnnouncement();
  if (!announcement) return null;

  return (
    <div
      className="w-full px-4 py-2 text-center text-[11px] font-medium tracking-wide sm:text-xs"
      style={{
        backgroundColor: announcement.background_color,
        color: announcement.text_color,
      }}
    >
      <AnnouncementBarText text={announcement.text} />
    </div>
  );
}
