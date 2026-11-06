/**
 * Product constants. Pricing shown here is the *fallback* display copy; live
 * prices always come from the store via RevenueCat when it is configured.
 */
/**
 * First Google Play release is free: every premium feature is unlocked for
 * everyone, the paywall is hidden, and scans stay capped per day to bound
 * model costs. The server enforces its own caps too. Set to false to turn
 * subscriptions back on (needs RevenueCat keys and Play Console products).
 */
export const FREE_LAUNCH = true;

export const FREE_DAILY_SCANS = 10;
export const FREE_COLLECTION_LIMIT = 75;
export const RECENT_SCANS_KEPT = 30;

export const PREMIUM_ENTITLEMENT = 'premium';

export const FALLBACK_PRICING = {
  monthly: { price: 9.99, label: '$9.99', period: 'month' },
  yearly: { price: 59.99, label: '$59.99', period: 'year', monthlyEquivalent: '$5.00', savings: 'Save 50%' },
  trialDays: 7,
} as const;

/** Shown next to every result. Deliberately makes no accuracy promise. */
export const RESULT_DISCLAIMER = "Results are based on visual analysis. If something looks wrong, use the report button: reports help us improve results.";

/** Shown under every original / reissue / bootleg verdict. */
export const VERDICT_CAVEAT = "AI estimate from photos, not proof of authenticity. Don't accuse a seller on this result alone.";

/** Visual grading can't hear the record. Shown with every condition estimate. */
export const AUDIO_CAVEAT = "Grades are estimated from photos only. They can't detect surface noise, pops, skips or groove wear, so play the record before you buy or sell on this grade.";

/** Required by the Discogs API terms next to any data that came from Discogs, linked to its Discogs page. */
export const DISCOGS_ATTRIBUTION = 'Data provided by Discogs.';

/** Required by the Discogs API terms, shown prominently in the app (Profile) and on the support and privacy pages. */
export const DISCOGS_NOTICE =
  "This application uses Discogs' API but is not affiliated with, sponsored or endorsed by Discogs. 'Discogs' is a trademark of Zink Media, LLC.";

/** The one place the app's support, privacy and feedback address is set. The server has its own single constant (server/src/contact.ts). */
export const SUPPORT_EMAIL = 'lanansipsip@gmail.com';

/**
 * True only in development builds (Metro sets __DEV__). Read through globalThis so plain
 * Node unit tests, which have no __DEV__, behave like a release build.
 */
export const IS_DEV = (globalThis as { __DEV__?: boolean }).__DEV__ === true;

export const env = {
  visionProvider: (process.env.EXPO_PUBLIC_VISION_PROVIDER ?? 'mock') as 'mock' | 'proxy',
  visionProxyUrl: process.env.EXPO_PUBLIC_VISION_PROXY_URL ?? '',
  revenueCatIos: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '',
  revenueCatAndroid: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '',
  /** Must match APP_KEY on the server when the server sets one. */
  appKey: process.env.EXPO_PUBLIC_APP_KEY ?? '',
};

/**
 * Pages served by the Labelsight server (server/public): privacy policy, terms of use (EULA) and support.
 * The live server is the only web address this project controls.
 */
export const PUBLIC_SERVER_URL = 'https://vinylvault-vision.onrender.com';

export function legalUrl(page: 'privacy' | 'terms' | 'support'): string {
  const base = env.visionProxyUrl.startsWith('https://') ? env.visionProxyUrl : PUBLIC_SERVER_URL;
  return `${base.replace(/\/$/, '')}/${page}`;
}

export const DEFAULT_TAGS = ['Favorites', 'First Pressings', 'For Sale', 'Needs Cleaning', 'Needs Review'] as const;
