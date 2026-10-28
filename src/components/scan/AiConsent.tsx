import { Modal, ScrollView, View } from 'react-native';
import { Button, Text } from '@/components/ui';
import { colors, radii, spacing } from '@/theme';

/**
 * Asked once, before the first scan is analysed. Apple (5.1.2) requires apps to
 * say clearly when personal data goes to a third-party AI and to get permission
 * first, so this names Anthropic and says what happens to the photos.
 */
export function AiConsent({ visible, onAllow, onCancel }: { visible: boolean; onAllow: () => void; onCancel: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.xl }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, maxHeight: '90%' }}>
          <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}>
            <Text variant="title">Your photos are analysed by AI</Text>
            <Text variant="body">
              To identify your record and estimate its condition, VinylVault sends the photos you take or choose to <Text variant="bodyStrong">Claude, an AI service run by Anthropic</Text>.
            </Text>
            <Text variant="body">
              Anthropic analyses them for VinylVault as our service provider and isn’t allowed to use them to train its AI. The VinylVault server doesn’t save your photos. Please
              photograph records, not people or documents.
            </Text>
            <Text variant="caption" tone="secondary">
              Details are in the privacy policy under Profile.
            </Text>
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <Button label="Allow and analyse" full onPress={onAllow} />
              <Button label="Not now" variant="secondary" full onPress={onCancel} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
