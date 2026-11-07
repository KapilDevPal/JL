import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useData } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { LOCATION_LABEL, type Location, type Product, type StockRequest } from '@/lib/types';
import { canApprove, canReceive, useRequestActions } from '@/lib/useRequestActions';
import { Button } from './Button';
import { ProductImage } from './ProductImage';
import { StatusPill } from './StatusPill';
import { colors, radius, space, type } from './theme';

type Props = {
  request: StockRequest;
  product: Product | undefined;
  myLocation: Location | null;
  actions: ReturnType<typeof useRequestActions>;
  onPress: () => void;
};

export function RequestCard({ request, product, myLocation, actions, onPress }: Props) {
  const { nameOf } = useData();
  const busy = actions.busyId === request.id;
  const showApprove = canApprove(request, myLocation);
  const showReceive = canReceive(request, myLocation);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View style={styles.row}>
        <ProductImage path={product?.image_paths[0]} style={styles.thumb} />
        <View style={styles.info}>
          <Text style={type.heading} numberOfLines={1}>
            {product?.name ?? 'Product'}
          </Text>
          <Text style={styles.qty}>{request.quantity} pcs</Text>
          <Text style={type.label}>
            {LOCATION_LABEL[request.from_location]} → {LOCATION_LABEL[request.to_location]}
          </Text>
        </View>
      </View>
      <View style={styles.people}>
        <Text style={type.small} numberOfLines={1}>
          Requested by <Text style={styles.person}>{nameOf(request.created_by)}</Text>
        </Text>
        {request.responded_by && (
          <Text style={type.small} numberOfLines={1}>
            {request.status === 'rejected' ? 'Rejected by ' : 'Sent by '}
            <Text style={styles.person}>{nameOf(request.responded_by)}</Text>
          </Text>
        )}
        {request.received_by && (
          <Text style={type.small} numberOfLines={1}>
            Received by <Text style={styles.person}>{nameOf(request.received_by)}</Text>
          </Text>
        )}
      </View>
      <View style={styles.meta}>
        <StatusPill status={request.status} />
        <Text style={type.small}>{formatDate(request.created_at)}</Text>
      </View>

      {showApprove && (
        <View style={styles.actions}>
          <Button
            title="Reject"
            variant="danger"
            style={styles.flex}
            disabled={!actions.online || busy}
            onPress={() => actions.reject(request)}
          />
          <Button
            title="Approve"
            style={styles.flex}
            loading={busy}
            disabled={!actions.online}
            onPress={() => actions.approve(request)}
          />
        </View>
      )}
      {showReceive && (
        <View style={styles.actions}>
          <Button
            title="Received"
            style={styles.flex}
            loading={busy}
            disabled={!actions.online}
            onPress={() => actions.receive(request)}
          />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: space.md,
  },
  row: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  thumb: { width: 72, height: 72, borderRadius: radius.md },
  info: { flex: 1, gap: 2 },
  qty: { fontSize: 16, fontWeight: '600', color: colors.champagneDark },
  people: { gap: 2 },
  person: { color: colors.text, fontWeight: '600' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
});
