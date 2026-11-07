import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useData } from './data';
import { friendlyError } from './errors';
import { useIsOnline } from './network';
import { supabase } from './supabase';
import { LOCATION_LABEL, type Location, type StockRequest } from './types';

type Rpc = 'approve_request' | 'reject_request' | 'complete_request';

export function canApprove(request: StockRequest, myLocation: Location | null | undefined) {
  return request.status === 'pending' && request.from_location === myLocation;
}

export function canReceive(request: StockRequest, myLocation: Location | null | undefined) {
  return request.status === 'approved' && request.to_location === myLocation;
}

/**
 * Approve / reject / receive with a confirmation step. A per-request lock
 * ignores repeated taps; the database rejects duplicates regardless.
 */
export function useRequestActions() {
  const { refresh, productsById } = useData();
  const online = useIsOnline();
  const locks = useRef(new Set<string>());
  const [busyId, setBusyId] = useState<string | null>(null);

  const run = useCallback(
    async (request: StockRequest, rpc: Rpc) => {
      if (locks.current.has(request.id)) return;
      if (!online) {
        Alert.alert('You are offline', 'Connect to the internet and try again.');
        return;
      }
      locks.current.add(request.id);
      setBusyId(request.id);
      try {
        const { error } = await supabase.rpc(rpc, { p_request_id: request.id });
        if (error) throw error;
      } catch (e) {
        Alert.alert('Could not update request', friendlyError(e));
      } finally {
        await refresh();
        locks.current.delete(request.id);
        setBusyId(null);
      }
    },
    [online, refresh],
  );

  const describe = (r: StockRequest) => `${r.quantity} × ${productsById.get(r.product_id)?.name ?? 'item'}`;

  const approve = (r: StockRequest) =>
    Alert.alert(
      'Approve and send?',
      `${describe(r)} will be taken from ${LOCATION_LABEL[r.from_location]} stock and sent to ${LOCATION_LABEL[r.to_location]}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve', onPress: () => run(r, 'approve_request') },
      ],
    );

  const reject = (r: StockRequest) =>
    Alert.alert('Reject request?', `${describe(r)} will not be sent.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => run(r, 'reject_request') },
    ]);

  const receive = (r: StockRequest) =>
    Alert.alert('Confirm received?', `${describe(r)} will be added to ${LOCATION_LABEL[r.to_location]} stock.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Received', onPress: () => run(r, 'complete_request') },
    ]);

  return { approve, reject, receive, busyId, online };
}
