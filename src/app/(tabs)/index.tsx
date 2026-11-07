import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { inputStyle } from '@/components/Field';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ProductImage } from '@/components/ProductImage';
import { colors, radius, space, type } from '@/components/theme';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { useIsOnline } from '@/lib/network';
import { LOCATION_LABEL, otherLocation, type Location, type Product } from '@/lib/types';

type Transit = { quantity: number; to: Location }[];

export default function Products() {
  const { products, requests, loading, error, refresh } = useData();
  const { profile } = useAuth();
  const online = useIsOnline();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Approved but not yet received = in transit.
  const inTransit = useMemo(() => {
    const map = new Map<string, Transit>();
    for (const r of requests) {
      if (r.status !== 'approved') continue;
      const list = map.get(r.product_id) ?? [];
      list.push({ quantity: r.quantity, to: r.to_location });
      map.set(r.product_id, list);
    }
    return map;
  }, [requests]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
  }, [products, query]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <View style={styles.screen}>
      <OfflineBanner />
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.muted} style={styles.searchIcon} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search products"
          placeholderTextColor={colors.muted}
          style={[inputStyle, styles.search]}
          clearButtonMode="while-editing"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {loading && products.length === 0 ? (
        <ActivityIndicator style={styles.center} color={colors.champagne} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.champagne} />}
          ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : undefined}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={type.heading}>{query ? 'No matching products' : 'No products yet'}</Text>
              {!query && profile?.is_admin && (
                <Button title="Add a product" onPress={() => router.push('/product-form')} style={styles.emptyButton} />
              )}
            </View>
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              transit={inTransit.get(item.id)}
              myLocation={profile?.location ?? null}
              isAdmin={!!profile?.is_admin}
              online={online}
            />
          )}
        />
      )}
    </View>
  );
}

function ProductCard({
  product,
  transit,
  myLocation,
  isAdmin,
  online,
}: {
  product: Product;
  transit: Transit | undefined;
  myLocation: Location | null;
  isAdmin: boolean;
  online: boolean;
}) {
  const source = myLocation ? otherLocation(myLocation) : null;
  const sourceStock = source ? product.stock[source] : 0;

  return (
    <View style={styles.card}>
      <ProductImage path={product.image_path} style={styles.image} />
      <View style={styles.cardBody}>
        <Text style={type.heading}>{product.name}</Text>

        <View style={styles.stockRow}>
          {(['main_store', 'warehouse'] as const).map((loc) => (
            <View key={loc} style={[styles.stockBox, loc === myLocation && styles.stockBoxMine]}>
              <Text style={type.label}>{LOCATION_LABEL[loc]}</Text>
              <Text style={styles.stockValue}>{product.stock[loc]}</Text>
            </View>
          ))}
        </View>

        {transit?.map((t, i) => (
          <Text key={i} style={styles.transit}>
            {t.quantity} in transit to {LOCATION_LABEL[t.to]}
          </Text>
        ))}

        <View style={styles.actions}>
          {source && (
            <Button
              title={sourceStock > 0 ? `Request from ${LOCATION_LABEL[source]}` : `None at ${LOCATION_LABEL[source]}`}
              disabled={!online || sourceStock === 0}
              onPress={() => router.push({ pathname: '/request-new', params: { productId: product.id } })}
              style={styles.flex}
            />
          )}
          {isAdmin && (
            <Button
              title="Edit"
              variant="secondary"
              onPress={() => router.push({ pathname: '/product-form', params: { id: product.id } })}
              style={source ? styles.editButton : styles.flex}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { marginTop: space.xl },
  searchWrap: { paddingHorizontal: space.md, paddingBottom: space.sm, justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: space.md + 14, zIndex: 1 },
  search: { paddingLeft: 40, borderRadius: radius.pill },
  list: { padding: space.md, gap: space.lg, paddingBottom: space.xl },
  error: { color: colors.danger, marginBottom: space.sm },
  empty: { alignItems: 'center', marginTop: space.xl, gap: space.md },
  emptyButton: { alignSelf: 'stretch' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  image: { width: '100%', aspectRatio: 4 / 3 },
  cardBody: { padding: space.md, gap: space.md },
  stockRow: { flexDirection: 'row', gap: space.sm },
  stockBox: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    gap: 2,
  },
  stockBoxMine: { borderColor: colors.champagne, backgroundColor: colors.champagneSoft },
  stockValue: { fontSize: 22, fontWeight: '600', color: colors.text },
  transit: { fontSize: 14, color: '#4A5A75' },
  actions: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  editButton: { paddingHorizontal: space.lg },
});
