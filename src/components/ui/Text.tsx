import { Text as RNText, type TextProps } from 'react-native';
import { colors, type as typeScale, type TypeVariant } from '@/theme';

type Tone = 'primary' | 'secondary' | 'muted' | 'gold' | 'inverse';

const toneColor: Record<Tone, string> = {
  primary: colors.text,
  secondary: colors.textSecondary,
  muted: colors.textMuted,
  gold: colors.gold,
  inverse: colors.textInverse,
};

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  tone?: Tone;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

export function Text({ variant = 'body', tone = 'primary', color, align, style, ...rest }: AppTextProps) {
  return <RNText {...rest} style={[typeScale[variant], { color: color ?? toneColor[tone], textAlign: align }, style]} />;
}
