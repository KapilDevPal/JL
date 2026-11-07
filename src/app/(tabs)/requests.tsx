import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { OfflineBanner } from '@/components/OfflineBanner';
import { RequestCard } from '@/components/RequestCard';
import { colors, radius, space, type } from '@/components/theme';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { LOCATION_LABEL, otherLocation, type StockRequest } from '@/lib/types';
import { useRequestActions } from '@/lib/useRequestActions';

type Section = 'incoming' | 'outgoing' | 'history';

const isOpen = (r: StockRequest) => r.status === 'pending' || r.status === 'approved';

export default function Requests() {
  const { requests, productsById, loading, error, refresh } = useData();
  const { profile } = useAuth();
  const actions = useRequestActions();
  const myLocation = profile?.location ?? null;
  const [section, setSection] = useState<Section>('incoming');
  const [refreshing, setRefreshing] = useState(false);

  const lists = useMemo(
    () => ({
      // Asked of my location: I approve or reject. (Admins without a location see all open requests.)
      incoming: requests.filter((r) => isOpen(r) && (myLocation ? r.from_location === myLocation : true)),
      // Asked by my location: I confirm receipt.
      outgoing: requests.filter((r) => isOpen(r) && r.to_location === myLocation),
      history: requests.filter((r) => !isOpen(r)),
    }),
    [requests, myLocation],
  );

  const badges = {
    incoming: lists.incoming.filter((r) => r.status === 'pending').length,
    outgoing: lists.outgoing.filter((r) => r.status === 'approved').length,
    history: 0,
  };

  const other = myLocation ? LOCATION_LABEL[otherLocation(myLocation)] : null;
  const hint: Record<Section, string> = {
    incoming: other ? `Stock ${other} has asked you to send.` : 'All open requests.',
    outgoing: other ? `Stock you asked ${other} to send. Tap Received when it arrives.` : '',
    history: 'Received and rejected requests.',
  };

  const sections: Section[] = myLocation ? ['incoming', 'outgoing', 'history'] : ['incoming', 'history'];

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <View style={styles.screen}>
      <OfflineBanner />
      <View style={styles.segments}>
        {sections.map((s) => (
          <Pressable
            key={s}
            accessibilityRole="tab"
            accessibilityState={{ selected: section === s }}
            onPress={() => setSection(s)}
            style={[styles.segment, section === s && styles.segmentActive]}>
            <Text style={[styles.segmentText, section === s && styles.segmentTextActive]}>
              {s === 'incoming' && !myLocation ? 'Open' : s[0].toUpperCase() + s.slice(1)}
              {badges[s] > 0 ? `  ${badges[s]}` : ''}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={[type.small, styles.hint]}>{hint[section]}</Text>

      {loading && requests.length === 0 ? (
        <ActivityIndicator style={styles.center} color={colors.champagne} />
      ) : (
        <FlatList
          data={lists[section]}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.champagne} />}
          ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : undefined}
          ListEmptyComponent={<Text style={[type.label, styles.empty]}>Nothing here right now.</Text>}
          renderItem={({ item }) => (
            <RequestCard
              request={item}
              product={productsById.get(item.product_id)}
              myLocation={myLocation}
              actions={actions}
              onPress={() => router.push({ pathname: '/request/[id]', params: { id: item.id } })}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  segments: {
    flexDirection: 'row',
    marginHorizontal: space.md,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.champagneSoft,
  },
  segment: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  segmentText: { fontSize: 15, fontWeight: '600', color: colors.muted },
  segmentTextActive: { color: colors.text },
  hint: { marginHorizontal: space.md, marginTop: space.sm, textAlign: 'center' },
  center: { marginTop: space.xl },
  list: { padding: space.md, gap: space.md, paddingBottom: space.xl },
  error: { color: colors.danger, marginBottom: space.sm },
  empty: { textAlign: 'center', marginTop: space.xl },
});
