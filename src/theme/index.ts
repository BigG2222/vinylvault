import { Platform, TextStyle } from 'react-native';
import type { CheckStatus, PressingVerdict } from '@/types';

/**
 * VinylVault design tokens (shared with CardVault). Dark-first: deep navy surfaces, cream text,
 * gold reserved for value and premium, semantic colors only for verdicts.
 */
export const colors = {
  bg: '#070B14',
  bgElevated: '#0B1120',
  surface: '#0F1728',
  surfaceRaised: '#152036',
  surfacePressed: '#1A2741',
  border: '#1E2A42',
  borderStrong: '#2B3A57',

  text: '#F4EEE1',
  textSecondary: '#A7B0C2',
  textMuted: '#6F7A90',
  textInverse: '#0A0F1C',

  navy: '#16305E',
  navyBright: '#2A4F8F',
  gold: '#D6B46A',
  goldBright: '#E9CD8C',
  goldDim: '#8C7442',
  cream: '#F1E6C8',

  authentic: '#3DBE8B',
  likely: '#8FCB72',
  review: '#E8A93B',
  risk: '#EA5A4F',
  info: '#6EA8FE',

  overlay: 'rgba(4, 7, 14, 0.72)',
  scrim: 'rgba(4, 7, 14, 0.45)',
} as const;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;

export const radii = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

export const type = {
  display: { fontFamily: serif, fontSize: 32, lineHeight: 38, fontWeight: '600', letterSpacing: -0.4 },
  title: { fontFamily: serif, fontSize: 24, lineHeight: 30, fontWeight: '600', letterSpacing: -0.2 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.1 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
  number: { fontSize: 22, lineHeight: 26, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
  numberLarge: { fontFamily: serif, fontSize: 36, lineHeight: 42, fontWeight: '600', fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;


export const verdictMeta: Record<
  PressingVerdict,
  { label: string; short: string; color: string; icon: 'ribbon' | 'repeat' | 'eye' | 'warning'; blurb: string }
> = {
  likely_original: {
    label: 'Likely Original Pressing',
    short: 'Likely Original',
    color: colors.authentic,
    icon: 'ribbon',
    blurb: 'The checks are consistent with an original pressing of this release.',
  },
  reissue: {
    label: 'Reissue',
    short: 'Reissue',
    color: colors.info,
    icon: 'repeat',
    blurb: 'Looks like a legitimate later pressing, not the original.',
  },
  needs_review: {
    label: 'Needs Review',
    short: 'Needs Review',
    color: colors.review,
    icon: 'eye',
    blurb: 'Something looked off or could not be confirmed. Inspect the flagged checks.',
  },
  possible_bootleg: {
    label: 'Possible Bootleg',
    short: 'Possible Bootleg',
    color: colors.risk,
    icon: 'warning',
    blurb: 'Several checks failed or a strong counterfeit sign was found.',
  },
};

export const checkStatusMeta: Record<
  CheckStatus,
  { label: string; color: string; icon: 'checkmark-circle' | 'alert-circle' | 'close-circle' | 'remove-circle' | 'ellipse-outline' }
> = {
  pass: { label: 'Passed', color: colors.authentic, icon: 'checkmark-circle' },
  warn: { label: 'Uncertain', color: colors.review, icon: 'alert-circle' },
  fail: { label: 'Failed', color: colors.risk, icon: 'close-circle' },
  not_applicable: { label: 'Not applicable', color: colors.textMuted, icon: 'remove-circle' },
  skipped: { label: 'Not checked', color: colors.textMuted, icon: 'ellipse-outline' },
};

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };
