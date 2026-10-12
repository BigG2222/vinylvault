import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing } from '@/theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: 'md' | 'lg' | 'sm';
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

const palette: Record<Variant, { bg: string; fg: string; border: string; pressed: string }> = {
  primary: { bg: colors.gold, fg: colors.textInverse, border: colors.gold, pressed: colors.goldBright },
  secondary: { bg: 'transparent', fg: colors.text, border: colors.borderStrong, pressed: colors.surfacePressed },
  ghost: { bg: 'transparent', fg: colors.textSecondary, border: 'transparent', pressed: colors.surfacePressed },
  danger: { bg: 'transparent', fg: colors.risk, border: colors.risk + '66', pressed: colors.risk + '1A' },
};

export function Button({ label, onPress, variant = 'primary', size = 'md', icon, loading, disabled, full, style, accessibilityHint }: ButtonProps) {
  const p = palette[variant];
  const height = size === 'lg' ? 56 : size === 'sm' ? 36 : 48;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        { height, backgroundColor: pressed ? p.pressed : p.bg, borderColor: p.border, opacity: disabled ? 0.45 : 1 },
        full && { alignSelf: 'stretch' },
        size === 'sm' && { paddingHorizontal: spacing.md },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Ionicons name={icon} size={size === 'sm' ? 16 : 19} color={p.fg} />}
          <Text variant={size === 'sm' ? 'caption' : 'bodyStrong'} color={p.fg} style={size === 'sm' && { fontWeight: '600' }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
