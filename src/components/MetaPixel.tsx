"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useMarketingConsent } from "./MarketingConsent";
import { META_PIXEL_SCRIPT, syncMetaPixel } from "@/lib/meta-pixel";

export function MetaPixel() {
  const pathname = usePathname();
  const consent = useMarketingConsent();

  useEffect(() => {
    syncMetaPixel(pathname, consent);
  }, [pathname, consent]);

  // next/script loads this URL once across all App Router navigations.
  return consent === "granted"
    ? <Script id="vaeltx-meta-pixel" src={META_PIXEL_SCRIPT} strategy="afterInteractive" />
    : null;
}
