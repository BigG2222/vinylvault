/**
 * Product constants. Pricing shown here is the *fallback* display copy; live
 * prices always come from the store via RevenueCat when it is configured.
 */
export const FREE_DAILY_SCANS = 12;
export const FREE_COLLECTION_LIMIT = 75;
export const RECENT_SCANS_KEPT = 30;

export const PREMIUM_ENTITLEMENT = 'premium';

export const FALLBACK_PRICING = {
  monthly: { price: 9.99, label: '$9.99', period: 'month' },
  yearly: { price: 59.99, label: '$59.99', period: 'year', monthlyEquivalent: '$5.00', savings: 'Save 50%' },
  trialDays: 7,
} as const;

/** Shown next to every result. Deliberately makes no accuracy promise. */
export const RESULT_DISCLAIMER = "Results are based on visual analysis. If something looks wrong, use the report button and we'll review it.";

/** Visual grading can't hear the record. Shown with every condition estimate. */
export const AUDIO_CAVEAT = "Grades are estimated from photos only. They can't detect surface noise, pops, skips or groove wear, so play the record before you buy or sell on this grade.";

/** Required by the Discogs API terms next to any data that came from Discogs. */
export const DISCOGS_ATTRIBUTION = 'Data provided by Discogs.';

export const SUPPORT_EMAIL = 'support@vinylvault.app';

export const env = {
  visionProvider: (process.env.EXPO_PUBLIC_VISION_PROVIDER ?? 'mock') as 'mock' | 'proxy',
  visionProxyUrl: process.env.EXPO_PUBLIC_VISION_PROXY_URL ?? '',
  revenueCatIos: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '',
  revenueCatAndroid: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '',
};

export const DEFAULT_TAGS = ['Favorites', 'First Pressings', 'For Sale', 'Needs Cleaning', 'Needs Review'] as const;
