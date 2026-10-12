import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui';
import { paletteFor } from '@/data/catalog';
import { colors } from '@/theme';
import type { RecordIdentity } from '@/types';

/**
 * Shows the user's cover photo when present; otherwise a typographic sleeve in
 * the release's palette, with the disc peeking out, so sample data and missing
 * photos still look intentional. `width` is the sleeve width; the disc adds a
 * little on the right when `disc` is set.
 */
export function RecordArt({ identity, uri, width, disc, style }: { identity: RecordIdentity; uri?: string; width: number; disc?: boolean; style?: StyleProp<ViewStyle> }) {
  const radius = Math.max(4, width * 0.03);
  const discSize = width * 0.92;
  const peek = disc ? width * 0.16 : 0;
  const [a, b] = paletteFor(identity);
  const small = width < 90;

  const sleeve = uri ? (
    <Image source={{ uri }} style={[{ width, height: width, borderRadius: radius, backgroundColor: colors.surfaceRaised }, style as StyleProp<ImageStyle>]} contentFit="cover" transition={150} />
  ) : (
    <View style={{ width, height: width, borderRadius: radius, overflow: 'hidden' }} accessibilityLabel={`${identity.artist}, ${identity.title}`}>
      <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.ring, { width: width * 0.62, height: width * 0.62, borderRadius: width, top: width * 0.12, left: width * 0.19 }]} />
      <View style={[styles.text, { padding: width * 0.07 }]}>
        <Text style={{ color: 'rgba(255,255,255,0.95)', fontWeight: '800', fontSize: small ? 8 : Math.min(15, width * 0.075) }} numberOfLines={small ? 1 : 2}>
          {identity.artist.toUpperCase()}
        </Text>
        {!small && (
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: Math.min(12, width * 0.06), marginTop: 2 }} numberOfLines={2}>
            {identity.title}
          </Text>
        )}
      </View>
    </View>
  );

  if (!disc) return sleeve;
  return (
    <View style={[{ width: width + peek, height: width, justifyContent: 'center' }, style]}>
      <View style={[styles.disc, { width: discSize, height: discSize, borderRadius: discSize / 2, left: peek + width - discSize, top: (width - discSize) / 2 }]}>
        <View style={[styles.grooves, { width: discSize * 0.8, height: discSize * 0.8, borderRadius: discSize }]} />
        <View style={{ width: discSize * 0.34, height: discSize * 0.34, borderRadius: discSize, backgroundColor: b, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.bg }} />
        </View>
      </View>
      {sleeve}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  text: { flex: 1, justifyContent: 'flex-end' },
  disc: { position: 'absolute', backgroundColor: '#0A0A0D', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1C1C22' },
  grooves: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
});
