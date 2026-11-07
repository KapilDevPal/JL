import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ProductImage } from '@/components/ProductImage';
import { QrCode } from '@/components/QrCode';
import { StatusPill } from '@/components/StatusPill';
import { colors, radius, space, type } from '@/components/theme';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { requestQrValue } from '@/lib/requestQr';
import { LOCATION_LABEL } from '@/lib/types';
import { canApprove, canReceive, useRequestActions } from '@/lib/useRequestActions';

export default function RequestDetails() {
  const { id, scanned } = useLocalSearchParams<{ id: string; scanned?: string }>();
  const { requests, productsById, nameOf, loading } = useData();
  const { profile, session } = useAuth();
  const actions = useRequestActions();

  const request = requests.find((r) => r.id === id);
  if (!request) {
    return loading || scanned ? (
      <ActivityIndicator style={styles.missing} color={colors.champagne} />
    ) : (
      <Text style={[type.body, styles.missing]}>This request is no longer available.</Text>
    );
  }
  const product = productsById.get(request.product_id);
  const myLocation = profile?.location ?? null;
  const busy = actions.busyId === request.id;
  const me = session?.user.id;
  const who = (userId: string | null) => (userId === me ? `${nameOf(userId)} (you)` : nameOf(userId));
  const from = LOCATION_LABEL[request.from_location];
  const to = LOCATION_LABEL[request.to_location];

  const rows: [string, string][] = [
    ['From', from],
    ['To', to],
    ['Requested by', who(request.created_by)],
    ['Requested', formatDate(request.created_at)],
  ];
  if (request.status === 'approved' || request.status === 'completed') {
    rows.push(['Approved and sent by', who(request.responded_by)]);
    if (request.approved_at) rows.push(['Sent', formatDate(request.approved_at)]);
  }
  if (request.status === 'rejected') rows.push(['Rejected by', who(request.responded_by)]);
  if (request.status === 'completed') {
    rows.push(['Received by', who(request.received_by)]);
    if (request.completed_at) rows.push(['Received', formatDate(request.completed_at)]);
  }

  // Show the QR to the person who is NOT taking the next step, so the person
  // who is can scan it instead of searching for the request.
  const qrHint =
    request.status === 'pending' && myLocation === request.to_location
      ? `${from} staff can scan this to open the request and approve it.`
      : request.status === 'approved' && myLocation === request.from_location
        ? `Show this when delivering. ${to} staff scan it to confirm they received it.`
        : null;

  const showApprove = canApprove(request, myLocation);
  const showReceive = canReceive(request, myLocation);

  return (
    <View style={styles.screen}>
      <OfflineBanner />
      <ScrollView contentContainerStyle={styles.body}>
        {scanned && (showApprove || showReceive) && (
          <View style={styles.scanned}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.scannedText}>QR code scanned. Check the details, then {showApprove ? 'approve' : 'confirm receipt'}.</Text>
          </View>
        )}

        <View style={styles.header}>
          <ProductImage path={product?.image_paths[0]} style={styles.image} />
          <View style={styles.flex}>
            <Text style={type.heading}>{product?.name ?? 'Product'}</Text>
            <Text style={styles.qty}>{request.quantity} pcs</Text>
            <StatusPill status={request.status} />
          </View>
        </View>

        <View style={styles.table}>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.row}>
              <Text style={type.label}>{label}</Text>
              <Text style={[type.body, styles.value]} numberOfLines={1}>
                {value}
              </Text>
            </View>
          ))}
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
          <Button title="Received" loading={busy} disabled={!actions.online} onPress={() => actions.receive(request)} />
        )}

        {qrHint && (
          <View style={styles.qrCard}>
            <QrCode value={requestQrValue(request.id)} size={200} />
            <Text style={[type.small, styles.qrHint]}>{qrHint}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { padding: space.lg, gap: space.lg, paddingBottom: space.xl },
  missing: { padding: space.lg },
  scanned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: space.md,
  },
  scannedText: { flex: 1, color: colors.success, fontSize: 14, fontWeight: '600' },
  header: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  image: { width: 96, height: 96, borderRadius: radius.md },
  flex: { flex: 1, gap: 4 },
  qty: { fontSize: 18, fontWeight: '600', color: colors.champagneDark },
  table: { borderTopWidth: 1, borderColor: colors.border },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  value: { flexShrink: 1, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: space.sm },
  qrCard: {
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qrHint: { textAlign: 'center', lineHeight: 19 },
});
