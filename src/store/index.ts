import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_TAGS, FREE_COLLECTION_LIMIT, FREE_DAILY_SCANS, FREE_LAUNCH, RECENT_SCANS_KEPT } from '@/config';
import type { Scenario } from '@/data/generate';
import { buildSampleData } from '@/data/samples';
import { expirePrice, isPriceExpired, withoutInventedPrice } from '@/services/pricing';
import { setDeviceId } from '@/services/serverHeaders';
import type { SubscriptionState } from '@/services/subscriptions';
import type { CollectionRecord, RecordIdentity, ScanResult, ScanSource, WrongResultReport } from '@/types';
import { todayKey, uid } from '@/utils/format';

interface Prefs {
  viewMode: 'grid' | 'list';
  demoScenario: Scenario | 'auto';
}

/** During the free launch everyone gets every feature; only the daily scan cap applies. */
const LAUNCH_SUBSCRIPTION: SubscriptionState = { isPremium: true, willRenew: false, expiresAt: null, activePlan: null, managementUrl: null };
const FREE_SUBSCRIPTION: SubscriptionState = { isPremium: false, willRenew: false, expiresAt: null, activePlan: null, managementUrl: null };

interface AppState {
  hydrated: boolean;
  onboarded: boolean;
  /** Random per-install ID the server uses for its daily limits. Not tied to the person. */
  deviceId: string;
  collection: CollectionRecord[];
  scans: ScanResult[];
  usage: { day: string; count: number };
  subscription: SubscriptionState;
  prefs: Prefs;
  reports: WrongResultReport[];
  customTags: string[];
  /** The person agreed that scan photos are sent to Anthropic's Claude to be analysed (Apple 5.1.2). */
  aiConsent: boolean;

  completeOnboarding(): void;
  setAiConsent(v: boolean): void;
  clearSampleData(): void;
  recordScan(result: ScanResult): void;
  updateScan(result: ScanResult): void;
  saveScanToCollection(scanId: string): { ok: true; recordId: string } | { ok: false; reason: 'limit' | 'missing' | 'exists'; recordId?: string };
  updateRecord(id: string, patch: Partial<CollectionRecord>): void;
  removeRecord(id: string): void;
  setSubscription(s: SubscriptionState): void;
  /** Strips Discogs prices past the 6-hour limit of the Discogs API terms from saved records and scans. */
  expireOldPrices(): void;
  setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void;
  addReport(r: Omit<WrongResultReport, 'id' | 'createdAt'>): void;
  addTag(tag: string): void;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      onboarded: false,
      deviceId: uid('dev_'),
      collection: [],
      scans: [],
      usage: { day: todayKey(), count: 0 },
      subscription: FREE_LAUNCH ? LAUNCH_SUBSCRIPTION : FREE_SUBSCRIPTION,
      prefs: { viewMode: 'grid', demoScenario: 'auto' },
      reports: [],
      customTags: [],
      aiConsent: false,

      setAiConsent: (aiConsent) => set({ aiConsent }),
      completeOnboarding() {
        const { collection, scans } = get();
        // Seed sample records once so first-run screens aren't empty; clearly labelled and removable.
        if (!collection.length && !scans.length) {
          const sample = buildSampleData();
          set({ onboarded: true, collection: sample.collection, scans: sample.scans });
        } else {
          set({ onboarded: true });
        }
      },

      clearSampleData() {
        set((s) => ({ collection: s.collection.filter((c) => !c.isSample), scans: s.scans.filter((x) => !x.isSample) }));
      },

      recordScan(result) {
        set((s) => {
          const day = todayKey();
          const usage = s.usage.day === day ? { day, count: s.usage.count + 1 } : { day, count: 1 };
          return { usage, scans: [result, ...s.scans].slice(0, RECENT_SCANS_KEPT) };
        });
      },

      updateScan(result) {
        set((s) => ({ scans: s.scans.map((x) => (x.id === result.id ? result : x)) }));
      },

      saveScanToCollection(scanId) {
        const s = get();
        const scan = s.scans.find((x) => x.id === scanId);
        if (!scan) return { ok: false, reason: 'missing' };
        const existing = s.collection.find((c) => c.scanId === scanId);
        if (existing) return { ok: false, reason: 'exists', recordId: existing.id };
        const owned = s.collection.filter((c) => !c.isSample).length;
        if (!s.subscription.isPremium && owned >= FREE_COLLECTION_LIMIT) return { ok: false, reason: 'limit' };
        const now = new Date().toISOString();
        const identity = scan.matches[scan.selectedMatchIndex].identity;
        const record: CollectionRecord = {
          id: uid('rec_'),
          addedAt: now,
          updatedAt: now,
          identity,
          images: scan.images,
          condition: scan.condition,
          checks: scan.checks,
          observed: scan.observed,
          verdict: scan.verdict,
          price: scan.price,
          tags: [
            ...(scan.verdict === 'likely_original' ? ['First Pressings'] : []),
            ...(scan.verdict === 'needs_review' || scan.verdict === 'possible_bootleg' ? ['Needs Review'] : []),
          ],
          notes: '',
          scanId,
        };
        set({ collection: [record, ...s.collection] });
        return { ok: true, recordId: record.id };
      },

      updateRecord(id, patch) {
        set((s) => ({ collection: s.collection.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c)) }));
      },

      removeRecord(id) {
        set((s) => ({ collection: s.collection.filter((c) => c.id !== id) }));
      },

      expireOldPrices() {
        const now = Date.now();
        const stale = (p: { price: CollectionRecord['price'] }) => isPriceExpired(p.price, now) && !p.price.expired;
        const s = get();
        if (!s.collection.some(stale) && !s.scans.some(stale)) return;
        set({
          collection: s.collection.map((c) => (stale(c) ? { ...c, price: expirePrice(c.price) } : c)),
          scans: s.scans.map((x) => (stale(x) ? { ...x, price: expirePrice(x.price) } : x)),
        });
      },

      setSubscription(subscription) {
        if (FREE_LAUNCH) return;
        set({ subscription });
      },

      setPref(key, value) {
        set((s) => ({ prefs: { ...s.prefs, [key]: value } }));
      },

      addReport(r) {
        set((s) => ({ reports: [{ ...r, id: uid('rep_'), createdAt: new Date().toISOString() }, ...s.reports] }));
      },

      addTag(tag) {
        const t = tag.trim();
        if (!t) return;
        set((s) => (s.customTags.includes(t) || (DEFAULT_TAGS as readonly string[]).includes(t) ? s : { customTags: [...s.customTags, t] }));
      },
    }),
    {
      name: 'vinylvault-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hydrated, ...rest }) => rest,
      // Installs from before these fields existed: give them a device ID, and keep the launch unlock in force.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...p,
          // Release builds drop any invented price an older version saved (the old demo fallback).
          collection: (p.collection ?? current.collection).map((c) => withoutInventedPrice(c, c.identity)),
          scans: (p.scans ?? current.scans).map((x) => withoutInventedPrice(x, x.matches[x.selectedMatchIndex]?.identity ?? x.matches[0].identity)),
          deviceId: p.deviceId || current.deviceId,
          subscription: FREE_LAUNCH ? LAUNCH_SUBSCRIPTION : (p.subscription ?? current.subscription),
        };
      },
      onRehydrateStorage: () => () => {
        setDeviceId(useApp.getState().deviceId);
        useApp.getState().expireOldPrices();
        useApp.setState({ hydrated: true });
      },
    },
  ),
);

// ---- Derived selectors -----------------------------------------------------

export function scansRemaining(s: Pick<AppState, 'usage' | 'subscription'>): number {
  if (s.subscription.isPremium && !FREE_LAUNCH) return Infinity;
  const used = s.usage.day === todayKey() ? s.usage.count : 0;
  return Math.max(0, FREE_DAILY_SCANS - used);
}

export { collectionTotals } from '@/utils/totals';

export function allTags(customTags: string[]): string[] {
  return [...DEFAULT_TAGS, ...customTags];
}

// ---- In-flight scan session (not persisted) --------------------------------

export interface ScanDraft {
  frontUri?: string;
  backUri?: string;
  labelUri?: string;
  runoutUri?: string;
  /** Barcode digits, "none" when the collector confirmed there isn't one. */
  barcode?: string;
  /** Photos came from the library instead of the live camera. */
  source?: ScanSource;
  confirmedIdentity?: RecordIdentity;
  /** When re-checking an existing collection record. */
  rescanRecordId?: string;
  /** When re-running checks for an existing scan after a match correction. */
  replaceScanId?: string;
}

interface ScanSession {
  draft: ScanDraft;
  setDraft(patch: Partial<ScanDraft>): void;
  reset(initial?: ScanDraft): void;
}

export const useScanSession = create<ScanSession>((set) => ({
  draft: {},
  setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  reset: (initial = {}) => set({ draft: initial }),
}));
