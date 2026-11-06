import { Platform, TextStyle } from 'react-native';

import { colors } from './tokens';

export { colors, verdictMeta, checkStatusMeta } from './tokens';

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


export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };
