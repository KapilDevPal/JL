import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ProductImage } from '@/components/ProductImage';
import { StatusPill } from '@/components/StatusPill';
import { colors, radius, space, type } from '@/components/theme';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { LOCATION_LABEL } from '@/lib/types';
import { canApprove, canReceive, useRequestActions } from '@/lib/useRequestActions';

export default function RequestDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { requests, productsById } = useData();
  const { profile, session } = useAuth();
  const actions = useRequestActions();

  const request = requests.find((r) => r.id === id);
  if (!request) {
    return <Text style={[type.body, styles.missing]}>This request is no longer available.</Text>;
  }
  const product = productsById.get(request.product_id);
  const myLocation = profile?.location ?? null;
  const busy = actions.busyId === request.id;

  const rows: [string, string][] = [
    ['From', LOCATION_LABEL[request.from_location]],
    ['To', LOCATION_LABEL[request.to_location]],
    ['Requested', `${formatDate(request.created_at)}${request.created_by === session?.user.id ? ' by you' : ''}`],
  ];
  if (request.approved_at) rows.push(['Approved and sent', formatDate(request.approved_at)]);
  if (request.completed_at) rows.push(['Received', formatDate(request.completed_at)]);

  return (
    <View style={styles.screen}>
      <OfflineBanner />
      <ScrollView contentContainerStyle={styles.body}>
        <ProductImage path={product?.image_path} style={styles.image} />
        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <Text style={type.title}>{product?.name ?? 'Product'}</Text>
            <Text style={styles.qty}>{request.quantity} pcs</Text>
          </View>
          <StatusPill status={request.status} />
        </View>

        <View style={styles.table}>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.row}>
              <Text style={type.label}>{label}</Text>
              <Text style={type.body}>{value}</Text>
            </View>
          ))}
        </View>

        {canApprove(request, myLocation) && (
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
        {canReceive(request, myLocation) && (
          <Button title="Received" loading={busy} disabled={!actions.online} onPress={() => actions.receive(request)} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { padding: space.lg, gap: space.lg },
  missing: { padding: space.lg },
  image: { width: '100%', aspectRatio: 1, borderRadius: radius.lg },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  flex: { flex: 1 },
  qty: { fontSize: 18, fontWeight: '600', color: colors.champagneDark, marginTop: 4 },
  table: { borderTopWidth: 1, borderColor: colors.border },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  actions: { flexDirection: 'row', gap: space.sm },
});
