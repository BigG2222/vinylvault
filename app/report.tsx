import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, TextInput, View } from 'react-native';
import { Button, Chip, IconButton, Row, Screen, Text } from '@/components/ui';
import { env, SUPPORT_EMAIL } from '@/config';
import { serverHeaders } from '@/services/serverHeaders';
import { usingServer } from '@/services/vision/registry';
import { useApp } from '@/store';
import { colors, radii, spacing } from '@/theme';
import type { WrongResultReport } from '@/types';

const REASONS: { key: WrongResultReport['reason']; label: string }[] = [
  { key: 'wrong_release', label: 'Wrong album or artist' },
  { key: 'wrong_pressing', label: 'Wrong pressing (country, year, label)' },
  { key: 'wrong_authenticity', label: 'Original / bootleg result is wrong' },
  { key: 'wrong_condition', label: 'Grade is off' },
  { key: 'wrong_price', label: 'Value looks wrong' },
  { key: 'offensive', label: 'Something offensive or harmful' },
  { key: 'other', label: 'Something else' },
];

function notify(title: string, body: string, buttons: { text: string; onPress?: () => void }[]) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${body}`);
    buttons[0]?.onPress?.();
  } else Alert.alert(title, body, buttons);
}

/**
 * Sends the report to the VinylVault server (Google Play's AI-generated content
 * policy asks for in-app reporting of AI results). No photos are sent: only the
 * reason, the note and which record the result named.
 */
async function sendReport(reason: string, note: string, result: string): Promise<boolean> {
  if (!usingServer()) return false;
  try {
    const res = await fetch(`${env.visionProxyUrl.replace(/\/$/, '')}/v1/report-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...serverHeaders() },
      body: JSON.stringify({ reason, note, result }),
    });
    return res.ok || res.status === 429;
  } catch {
    return false;
  }
}

export default function Report() {
  const { scanId, recordId } = useLocalSearchParams<{ scanId?: string; recordId?: string }>();
  const addReport = useApp((s) => s.addReport);
  const hasAlternates = useApp((s) => (scanId ? (s.scans.find((x) => x.id === scanId)?.matches.length ?? 0) > 1 : false));
  const identity = useApp((s) => {
    const scan = scanId ? s.scans.find((x) => x.id === scanId) : undefined;
    return scan ? scan.matches[scan.selectedMatchIndex]?.identity : s.collection.find((r) => r.id === recordId)?.identity;
  });
  const [reason, setReason] = useState<WrongResultReport['reason'] | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!reason) return;
    const note = message.trim();
    addReport({ scanId, recordId, reason, message: note });
    setSending(true);
    const sent = await sendReport(reason, note, identity ? `${identity.artist} – ${identity.title} (${identity.year})` : '');
    setSending(false);
    if (sent) {
      notify('Thanks for telling us', 'Reports help us improve VinylVault’s results.', [{ text: 'Done', onPress: () => router.back() }]);
    } else {
      const label = REASONS.find((r) => r.key === reason)?.label ?? 'Wrong result';
      const mail = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`VinylVault: ${label}`)}&body=${encodeURIComponent(`${identity ? `${identity.artist} – ${identity.title}\n\n` : ''}${note}`)}`;
      notify('Couldn’t send the report', 'Check your connection, or email it to us instead.', [
        { text: 'Email it', onPress: () => void Linking.openURL(mail) },
        { text: 'Cancel', onPress: () => undefined },
      ]);
    }
  };

  return (
    <Screen edges={['top', 'bottom']} keyboardShouldPersistTaps="handled">
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="title">This looks wrong</Text>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
      </Row>
      <Text variant="body" tone="secondary">
        VinylVault uses AI to identify and check records, and it can get things wrong. Tell us what's off: reports help us improve results for everyone.
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

      <Button label="Send report" size="lg" disabled={!reason} loading={sending} onPress={submit} />
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
