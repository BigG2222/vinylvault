import type { ReactNode } from 'react';
import { ExpiredPrice, Surface } from '@/components/ui';
import { useFreshPrice } from '@/services/pricing/useFreshPrice';
import type { ConditionEstimate, PriceEstimate, RecordIdentity } from '@/types';

/**
 * Shows the price panels only while the price may be displayed. An expired Discogs price
 * (older than the Discogs API terms allow) is fetched again, and the panels come back with it.
 */
export function FreshPriceGate({
  price,
  identity,
  condition,
  save,
  children,
}: {
  price: PriceEstimate;
  identity: RecordIdentity;
  condition: ConditionEstimate;
  save: (p: PriceEstimate) => void;
  children: ReactNode;
}) {
  const { expired, state, refresh } = useFreshPrice(price, identity, condition, save);
  if (!expired) return <>{children}</>;
  return (
    <Surface>
      <ExpiredPrice state={state} onRetry={refresh} />
    </Surface>
  );
}
