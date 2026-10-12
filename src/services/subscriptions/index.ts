import { Linking, Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
import { env, FALLBACK_PRICING, PREMIUM_ENTITLEMENT } from '@/config';

export type PlanId = 'monthly' | 'yearly';

export interface Plan {
  id: PlanId;
  priceString: string;
  price: number;
  period: 'month' | 'year';
  /** Free trial length in days, if the store offers one for this user. */
  trialDays: number | null;
  /** Only for yearly: per-month equivalent display. */
  perMonth?: string;
  pkg?: PurchasesPackage;
}

export interface SubscriptionState {
  isPremium: boolean;
  willRenew: boolean;
  expiresAt: string | null;
  activePlan: PlanId | null;
  managementUrl: string | null;
}

const apiKey = Platform.select({ ios: env.revenueCatIos, android: env.revenueCatAndroid, default: '' });

/** Without a RevenueCat key the app runs against an in-memory store so paywall UI is testable. */
export const isMockStore = !apiKey;

let configured = false;
let mockPremium: SubscriptionState | null = null;

export function configureSubscriptions(onChange: (s: SubscriptionState) => void) {
  if (configured || isMockStore) return;
  Purchases.configure({ apiKey: apiKey! });
  configured = true;
  Purchases.addCustomerInfoUpdateListener((info) => onChange(toState(info)));
}

function toState(info: CustomerInfo): SubscriptionState {
  const ent = info.entitlements.active[PREMIUM_ENTITLEMENT];
  return {
    isPremium: Boolean(ent),
    willRenew: Boolean(ent?.willRenew),
    expiresAt: ent?.expirationDate ?? null,
    activePlan: ent ? (ent.productIdentifier.includes('year') || ent.productIdentifier.includes('annual') ? 'yearly' : 'monthly') : null,
    managementUrl: info.managementURL,
  };
}

const FREE_STATE: SubscriptionState = { isPremium: false, willRenew: false, expiresAt: null, activePlan: null, managementUrl: null };

export async function getSubscriptionState(): Promise<SubscriptionState> {
  if (isMockStore) return mockPremium ?? FREE_STATE;
  return toState(await Purchases.getCustomerInfo());
}

function fallbackPlans(): Plan[] {
  return [
    { id: 'monthly', priceString: FALLBACK_PRICING.monthly.label, price: FALLBACK_PRICING.monthly.price, period: 'month', trialDays: FALLBACK_PRICING.trialDays },
    { id: 'yearly', priceString: FALLBACK_PRICING.yearly.label, price: FALLBACK_PRICING.yearly.price, period: 'year', trialDays: FALLBACK_PRICING.trialDays, perMonth: FALLBACK_PRICING.yearly.monthlyEquivalent },
  ];
}

/** Live store prices (localized) when available, otherwise the configured list prices. */
export async function getPlans(): Promise<Plan[]> {
  if (isMockStore) return fallbackPlans();
  try {
    const offerings = await Purchases.getOfferings();
    const cur = offerings.current;
    if (!cur?.monthly || !cur?.annual) return fallbackPlans();
    const trial = (p: PurchasesPackage) => {
      const intro = p.product.introPrice;
      if (!intro || intro.price !== 0) return null;
      const unit = intro.periodUnit;
      const n = intro.periodNumberOfUnits;
      return unit === 'DAY' ? n : unit === 'WEEK' ? n * 7 : unit === 'MONTH' ? n * 30 : null;
    };
    const yearly = cur.annual.product;
    return [
      { id: 'monthly', priceString: cur.monthly.product.priceString, price: cur.monthly.product.price, period: 'month', trialDays: trial(cur.monthly), pkg: cur.monthly },
      {
        id: 'yearly',
        priceString: yearly.priceString,
        price: yearly.price,
        period: 'year',
        trialDays: trial(cur.annual),
        perMonth: yearly.pricePerMonthString ?? undefined,
        pkg: cur.annual,
      },
    ];
  } catch {
    return fallbackPlans();
  }
}

export type PurchaseOutcome = { ok: true; state: SubscriptionState } | { ok: false; cancelled: boolean; message?: string };

export async function purchase(plan: Plan): Promise<PurchaseOutcome> {
  if (isMockStore) {
    mockPremium = { isPremium: true, willRenew: true, expiresAt: null, activePlan: plan.id, managementUrl: null };
    return { ok: true, state: mockPremium };
  }
  if (!plan.pkg) return { ok: false, cancelled: false, message: 'This plan is not available right now.' };
  try {
    const { customerInfo } = await Purchases.purchasePackage(plan.pkg);
    return { ok: true, state: toState(customerInfo) };
  } catch (e: any) {
    return { ok: false, cancelled: Boolean(e?.userCancelled), message: e?.message };
  }
}

export async function restore(): Promise<SubscriptionState> {
  if (isMockStore) return mockPremium ?? FREE_STATE;
  return toState(await Purchases.restorePurchases());
}

/** Opens the platform's native subscription management (the "easy cancel" path). */
export async function manageSubscription(managementUrl: string | null) {
  if (isMockStore) {
    mockPremium = null;
    return;
  }
  try {
    await Purchases.showManageSubscriptions();
  } catch {
    const fallback =
      managementUrl ??
      (Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions');
    await Linking.openURL(fallback);
  }
}
