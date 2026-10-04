"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { MARKETING_COOKIE, parseMarketingConsent, syncMetaPixel, type MarketingConsent } from "@/lib/meta-pixel";
import styles from "./MarketingConsent.module.css";

const consentEvent = "vaeltx:marketing-consent";
const getConsent = () => parseMarketingConsent(document.cookie);
const getServerConsent = () => null;

function subscribe(callback: () => void) {
  window.addEventListener(consentEvent, callback);
  window.addEventListener("focus", callback);
  document.addEventListener("visibilitychange", callback);
  return () => {
    window.removeEventListener(consentEvent, callback);
    window.removeEventListener("focus", callback);
    document.removeEventListener("visibilitychange", callback);
  };
}

export function useMarketingConsent(): MarketingConsent {
  return useSyncExternalStore(subscribe, getConsent, getServerConsent);
}

function chooseConsent(consent: Exclude<MarketingConsent, null>) {
  document.cookie = `${MARKETING_COOKIE}=${consent}; Path=/; Max-Age=15552000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  // Revoke immediately, before notifying React or navigating elsewhere.
  if (consent === "denied") {
    syncMetaPixel(location.pathname, consent);
    for (const name of ["_fbp", "_fbc"]) {
      document.cookie = `${name}=; Path=/; Max-Age=0`;
      const labels = location.hostname.split(".");
      for (let i = 0; i < labels.length - 1; i++) {
        document.cookie = `${name}=; Path=/; Max-Age=0; Domain=.${labels.slice(i).join(".")}`;
      }
    }
  }
  window.dispatchEvent(new Event(consentEvent));
}

function Choices() {
  return <div className={styles.actions}>
    <button type="button" onClick={() => chooseConsent("denied")}>Reject marketing</button>
    <button type="button" onClick={() => chooseConsent("granted")}>Accept marketing</button>
  </div>;
}

export function MarketingConsentBanner() {
  const consent = useMarketingConsent();
  if (consent !== null) return null;
  return <aside className={styles.banner} aria-label="Marketing privacy choices">
    <p>Allow Meta/Facebook Pixel for advertising measurement? It uses cookies and shares page visits and browser information with Meta. Optional; the site works without it. <Link href="/privacy">Privacy details</Link></p>
    <Choices />
  </aside>;
}

export function MarketingConsentSettings() {
  const consent = useMarketingConsent();
  return <div className={styles.settings}>
    <p role="status">Marketing tracking: {consent === "granted" ? "allowed" : "off"}. Change or withdraw your choice at any time.</p>
    <Choices />
  </div>;
}
