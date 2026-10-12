import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Button, IconButton, Row, Screen, Surface, Text } from '@/components/ui';
import { pickRecordPhoto } from '@/services/ondevice/pickPhoto';
import { scansRemaining, useApp, useScanSession } from '@/store';
import { colors, radii, spacing } from '@/theme';

type Slot = 'front' | 'back' | 'label' | 'runout';

const SLOTS: { key: Slot; label: string; hint: string }[] = [
  { key: 'front', label: 'Front cover', hint: 'Required' },
  { key: 'back', label: 'Back cover', hint: 'Recommended' },
  { key: 'label', label: 'Center label', hint: 'Recommended' },
  { key: 'runout', label: 'Runout', hint: 'Optional' },
];

/** Analyze a record from saved photos, e.g. to check a listing before buying. */
export default function UploadScan() {
  const [photos, setPhotos] = useState<Partial<Record<Slot, string>>>({});
  const [barcode, setBarcode] = useState('');
  const [busy, setBusy] = useState<Slot | null>(null);
  const usage = useApp((s) => s.usage);
  const subscription = useApp((s) => s.subscription);
  const resetDraft = useScanSession((s) => s.reset);

  const pick = async (slot: Slot) => {
    setBusy(slot);
    try {
      const uri = await pickRecordPhoto();
      if (uri) setPhotos((p) => ({ ...p, [slot]: uri }));
    } catch {
      Alert.alert("Couldn't open that photo", 'Please try a different image.');
    } finally {
      setBusy(null);
    }
  };

  const analyze = () => {
    if (!photos.front) return;
    if (scansRemaining({ usage, subscription }) <= 0) {
      router.push({ pathname: '/paywall', params: { reason: 'scans' } });
      return;
    }
    const digits = barcode.replace(/\D/g, '');
    resetDraft({ frontUri: photos.front, backUri: photos.back, labelUri: photos.label, runoutUri: photos.runout, barcode: digits.length >= 8 ? digits : undefined, source: 'library' });
    router.replace('/scan/processing');
  };

  return (
    <Screen edges={['top', 'bottom']} keyboardShouldPersistTaps="handled">
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="title">Check from photos</Text>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
      </Row>
      <Text variant="body" tone="secondary">
        Use saved photos, like a seller's listing pictures, to identify a pressing and check it before you buy.
      </Text>

      <View style={styles.grid}>
        {SLOTS.map((s) => (
          <PhotoSlot
            key={s.key}
            label={s.label}
            hint={s.hint}
            uri={photos[s.key]}
            busy={busy === s.key}
            onPress={() => pick(s.key)}
            onClear={() => setPhotos((p) => ({ ...p, [s.key]: undefined }))}
          />
        ))}
      </View>

      {photos.front && !photos.label && (
        <Row gap={spacing.sm} style={styles.note}>
          <Ionicons name="disc-outline" size={16} color={colors.review} />
          <Text variant="caption" style={{ flex: 1 }}>
            Ask the seller for a label photo if the listing doesn't have one. Without it, both label checks are skipped.
          </Text>
        </Row>
      )}

      <View style={{ gap: spacing.xs }}>
        <Text variant="label" tone="muted">
          Barcode digits (optional)
        </Text>
        <TextInput
          value={barcode}
          onChangeText={setBarcode}
          placeholder="e.g. from the listing description"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          style={styles.input}
          accessibilityLabel="Barcode digits"
        />
      </View>

      <Surface style={{ gap: spacing.sm }}>
        <Text variant="label" tone="muted">
          For the best result
        </Text>
        <Tip text="Save the seller's original photos rather than screenshotting the whole page." />
        <Tip text="Pick the largest, sharpest image available, with the whole cover or label visible." />
        <Tip text="On Android you can crop to the cover or label after choosing a photo." />
        <Tip text="Listing photos can hide scuffs and scratches, so treat the grade as a first opinion." />
      </Surface>

      <Button label="Analyze record" icon="sparkles" size="lg" disabled={!photos.front} onPress={analyze} />
    </Screen>
  );
}

function PhotoSlot({ label, hint, uri, busy, onPress, onClear }: { label: string; hint: string; uri?: string; busy: boolean; onPress: () => void; onClear: () => void }) {
  return (
    <View style={styles.cell}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.slot, uri && styles.slotFilled, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
        accessibilityLabel={uri ? `Change ${label.toLowerCase()} photo` : `Choose ${label.toLowerCase()} photo`}
      >
        {busy ? (
          <ActivityIndicator color={colors.gold} />
        ) : uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="images-outline" size={26} color={colors.gold} />
            <Text variant="caption" tone="secondary">
              Choose photo
            </Text>
          </View>
        )}
      </Pressable>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {label}
          </Text>
          <Text variant="caption" tone="muted">
            {hint}
          </Text>
        </View>
        {uri && <IconButton icon="trash-outline" size={18} color={colors.textMuted} label={`Remove ${label.toLowerCase()} photo`} onPress={onClear} />}
      </Row>
    </View>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <Row gap={spacing.sm} style={{ alignItems: 'flex-start' }}>
      <Ionicons name="checkmark" size={14} color={colors.gold} style={{ marginTop: 3 }} />
      <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
        {text}
      </Text>
    </Row>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { width: '47%', flexGrow: 1, gap: spacing.sm },
  slot: {
    aspectRatio: 1,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  slotFilled: { borderStyle: 'solid', borderColor: colors.gold + '88', backgroundColor: colors.bgElevated },
  note: { padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.review + '14', alignItems: 'flex-start' },
  input: { height: 46, color: colors.text, fontSize: 15, paddingHorizontal: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
});
