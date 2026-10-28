import { View } from 'react-native';
import { NoPrice, PremiumLock, PriceRange, Surface, Text } from '@/components/ui';
import { IS_DEV } from '@/config';
import { hasPriceRange } from '@/services/pricing';
import { spacing } from '@/theme';
import type { Grade, PriceEstimate } from '@/types';
import { GradePriceTable, SalesPanel } from './Panels';

/**
 * The value panels for a scan or record. A Discogs price-suggestion range is shown when there is one;
 * otherwise "No price available" with a link to Discogs. Example values appear only on sample
 * records and in development builds, and are labelled as examples.
 */
export function MarketValue({ price, isSample, isPremium, media, salesTitle }: { price: PriceEstimate; isSample?: boolean; isPremium: boolean; media: Grade; salesTitle?: string }) {
  if (!hasPriceRange(price, Date.now(), IS_DEV || Boolean(isSample))) {
    return (
      <Surface>
        <NoPrice price={price} />
      </Surface>
    );
  }
  return (
    <>
      <Surface style={{ gap: spacing.lg }}>
        <PriceRange price={price} />
        <View>
          {salesTitle ? (
            <Text variant="label" tone="muted" style={{ marginBottom: spacing.xs }}>
              {salesTitle}
            </Text>
          ) : null}
          <SalesPanel price={price} />
        </View>
      </Surface>
      <PremiumLock locked={!isPremium} title="Value at every grade" body="Discogs price suggestions for this pressing from Mint down to Poor.">
        <Surface>
          <GradePriceTable price={price} media={media} />
        </Surface>
      </PremiumLock>
    </>
  );
}
