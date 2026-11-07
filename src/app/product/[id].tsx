import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/Button';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ProductImage } from '@/components/ProductImage';
import { colors, radius, space, type } from '@/components/theme';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { useIsOnline } from '@/lib/network';
import { LOCATION_LABEL, otherLocation } from '@/lib/types';

export default function ProductDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { productsById, inTransit } = useData();
  const { profile } = useAuth();
  const online = useIsOnline();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  const product = id ? productsById.get(id) : undefined;
  if (!product) {
    return <Text style={[type.body, styles.missing]}>This product is no longer available.</Text>;
  }

  const imageSize = width - space.lg * 2;
  const photos: (string | null)[] = product.image_paths.length ? product.image_paths : [null];
  const myLocation = profile?.location ?? null;
  const source = myLocation ? otherLocation(myLocation) : null;
  const sourceStock = source ? product.stock[source] : 0;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: product.name }} />
      <OfflineBanner />
      <ScrollView contentContainerStyle={styles.body}>
        <View>
          <FlatList
            data={photos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(p, i) => p ?? `empty-${i}`}
            style={{ width: imageSize }}
            onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / imageSize))}
            renderItem={({ item }) => (
              <ProductImage path={item} style={{ width: imageSize, height: imageSize, borderRadius: radius.lg }} />
            )}
          />
          {photos.length > 1 && (
            <View style={styles.dots}>
              {photos.map((_, i) => (
                <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>

        <Text style={type.title}>{product.name}</Text>

        <View style={styles.stockRow}>
          {(['main_store', 'warehouse'] as const).map((loc) => (
            <View key={loc} style={[styles.stockBox, loc === myLocation && styles.stockBoxMine]}>
              <Text style={type.label}>{LOCATION_LABEL[loc]}</Text>
              <Text style={styles.stockValue}>{product.stock[loc]}</Text>
            </View>
          ))}
        </View>

        {inTransit.get(product.id)?.map((t, i) => (
          <Text key={i} style={styles.transit}>
            {t.quantity} in transit to {LOCATION_LABEL[t.to]}
          </Text>
        ))}

        {source && (
          <Button
            title={sourceStock > 0 ? `Request from ${LOCATION_LABEL[source]}` : `None at ${LOCATION_LABEL[source]}`}
            disabled={!online || sourceStock === 0}
            onPress={() => router.push({ pathname: '/request-new', params: { productId: product.id } })}
          />
        )}
        {profile?.is_admin && (
          <Button
            title="Edit product"
            variant="secondary"
            onPress={() => router.push({ pathname: '/product-form', params: { id: product.id } })}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xl },
  missing: { padding: space.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.sm },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.champagne },
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
});
