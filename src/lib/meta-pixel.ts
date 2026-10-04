export const META_PIXEL_ID = "1716784306059756";
export const META_PIXEL_SCRIPT = "https://connect.facebook.net/en_US/fbevents.js";
export const META_PIXEL_NOSCRIPT = `https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`;
export const MARKETING_COOKIE = "vaeltx_marketing_v1";
export type MarketingConsent = "granted" | "denied" | null;

export function parseMarketingConsent(cookie: string): MarketingConsent {
  const value = cookie.split(";").map(part => part.trim()).find(part => part.startsWith(`${MARKETING_COOKIE}=`))?.slice(MARKETING_COOKIE.length + 1);
  return value === "granted" || value === "denied" ? value : null;
}

type PixelCommand =
  | ["init", typeof META_PIXEL_ID]
  | ["set", "autoConfig", false, typeof META_PIXEL_ID]
  | ["consent", "grant" | "revoke"]
  | ["track", "PageView"];

type PixelQueue = {
  (...args: PixelCommand): void;
  callMethod?: (...args: PixelCommand) => void;
  queue: PixelCommand[];
  push: PixelQueue;
  loaded: boolean;
  version: string;
  disablePushState: boolean;
  allowDuplicatePageViews: boolean;
};

// Encapsulate Meta's globals here; application components never access them.
export type PixelHost = { fbq?: PixelQueue; _fbq?: PixelQueue };

export function createMetaPixelController(host: PixelHost) {
  let initialized = false;
  let lastPath: string | null = null;
  let granted = false;

  function initialize() {
    if (!host.fbq) {
      const fbq = Object.assign((...args: PixelCommand) => {
        if (fbq.callMethod) fbq.callMethod(...args);
        else fbq.queue.push(args);
      }, { queue: [] as PixelCommand[], loaded: true, version: "2.0", disablePushState: true, allowDuplicatePageViews: true }) as PixelQueue;
      fbq.push = fbq;
      host.fbq = fbq;
      host._fbq ??= fbq;
    }
    if (!initialized) {
      // Meta otherwise emits its own PageViews for History API/hash changes.
      // App Router is the sole owner of navigation event counting.
      host.fbq.disablePushState = true;
      // Meta otherwise suppresses subsequent explicit PageViews within the
      // same document. Our pathname guard owns deduplication instead.
      host.fbq.allowDuplicatePageViews = true;
      // Only explicit PageViews: disable automatic events / form detection.
      host.fbq("set", "autoConfig", false, META_PIXEL_ID);
      host.fbq("init", META_PIXEL_ID);
      initialized = true;
    }
    return host.fbq;
  }

  return {
    pageView(pathname: string, consent: MarketingConsent) {
      if (consent !== "granted") {
        if (granted) host.fbq?.("consent", "revoke");
        granted = false;
        lastPath = null;
        return;
      }
      const fbq = initialize();
      if (!granted) fbq("consent", "grant");
      granted = true;
      // Repeated effects, including Strict Mode, do not count as navigation.
      if (lastPath === pathname) return;
      lastPath = pathname;
      fbq("track", "PageView");
    },
  };
}

let controller: ReturnType<typeof createMetaPixelController> | undefined;
export function syncMetaPixel(pathname: string, consent: MarketingConsent) {
  controller ??= createMetaPixelController(window as Window & PixelHost);
  controller.pageView(pathname, consent);
}
