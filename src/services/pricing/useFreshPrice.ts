import { useCallback, useEffect, useState } from 'react';
import type { ConditionEstimate, PriceEstimate, RecordIdentity } from '@/types';
import { getPrice, isPriceExpired } from './index';

export type RefreshState = 'idle' | 'loading' | 'failed';

/**
 * Keeps a Discogs price within the 6-hour limit of the Discogs API terms: when the
 * saved price has expired, fetches it again on its own and hands it to `save`.
 * A demo fallback (server unreachable) never replaces a Discogs price.
 */
export function useFreshPrice(price: PriceEstimate, identity: RecordIdentity, condition: ConditionEstimate, save: (p: PriceEstimate) => void) {
  const expired = isPriceExpired(price);
  const [state, setState] = useState<RefreshState>('idle');

  const refresh = useCallback(async () => {
    setState('loading');
    try {
      const fresh = await getPrice(identity, condition);
      if (fresh.source !== 'discogs' || isPriceExpired(fresh)) {
        setState('failed');
        return;
      }
      save(fresh);
      setState('idle');
    } catch {
      setState('failed');
    }
  }, [identity, condition, save]);

  useEffect(() => {
    if (expired && state === 'idle') refresh();
    // Only react to the price expiring, not to every new callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  return { expired, state, refresh };
}
