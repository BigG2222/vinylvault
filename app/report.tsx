import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { Button, Chip, IconButton, Row, Screen, Text } from '@/components/ui';
import { useApp } from '@/store';
import { colors, radii, spacing } from '@/theme';
import type { WrongResultReport } from '@/types';

const REASONS: { key: WrongResultReport['reason']; label: string }[] = [
  { key: 'wrong_release', label: 'Wrong album or artist' },
  { key: 'wrong_pressing', label: 'Wrong pressing (country, year, label)' },
  { key: 'wrong_authenticity', label: 'Original / bootleg result is wrong' },
  { key: 'wrong_condition', label: 'Grade is off' },
  { key: 'wrong_price', label: 'Value looks wrong' },
  { key: 'other', label: 'Something else' },
];

export default function Report() {
  const { scanId, recordId } = useLocalSearchParams<{ scanId?: string; recordId?: string }>();
  const addReport = useApp((s) => s.addReport);
  const hasAlternates = useApp((s) => (scanId ? (s.scans.find((x) => x.id === scanId)?.matches.length ?? 0) > 1 : false));
  const [reason, setReason] = useState<WrongResultReport['reason'] | null>(null);
  const [message, setMessage] = useState('');

  const submit = () => {
    if (!reason) return;
    // Queued locally; send to your support backend (with the scan photos) when wiring up the API.
    addReport({ scanId, recordId, reason, message: message.trim() });
    Alert.alert("Thanks, we're on it", 'A person will review the photos and each check. We reply by email within 3 business days.', [{ text: 'Done', onPress: () => router.back() }]);
  };

  return (
    <Screen edges={['top', 'bottom']} keyboardShouldPersistTaps="handled">
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="title">This looks wrong</Text>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
      </Row>
      <Text variant="body" tone="secondary">
        Tell us what's off. Reports go to a person, not a bot, and they make the results better for everyone.
      </Text>

      {(reason === 'wrong_release' || reason === 'wrong_pressing') && hasAlternates && (
        <View style={styles.hint}>
          <Text variant="caption">Tip: you can pick the right pressing from the other matches on the result screen. The verdict and value update instantly.</Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {REASONS.map((r) => (
          <Chip key={r.key} label={r.label} selected={reason === r.key} onPress={() => setReason(r.key)} />
        ))}
      </View>

      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="Details help, e.g. “It's the 1978 Parlophone reissue, the runout ends in -2.”"
        placeholderTextColor={colors.textMuted}
        multiline
        style={styles.input}
        accessibilityLabel="Report details"
      />

      <Button label="Send report" size="lg" disabled={!reason} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 120,
    color: colors.text,
    fontSize: 15,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlignVertical: 'top',
  },
  hint: { padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.info + '14' },
});
