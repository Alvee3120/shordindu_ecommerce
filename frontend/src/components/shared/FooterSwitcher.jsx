"use client";

import FooterT from "@/components/shared/FooterT";
import { useSiteChrome } from "@/components/shared/useSiteChrome";

/** The site footer, hidden on every dashboard page. */
export default function FooterSwitcher() {
  const { showFooter } = useSiteChrome();
  return showFooter ? <FooterT /> : null;
}
