import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Transit } from '@/lib/data';
import { LOCATION_LABEL, otherLocation, type Location, type Product } from '@/lib/types';
import { Button } from './Button';
import { ProductImage } from './ProductImage';
import { colors, radius, space } from './theme';

export type CardLayout = 'list' | 'grid';

type Props = {
  product: Product;
  transit: Transit | undefined;
  myLocation: Location | null;
  online: boolean;
  layout: CardLayout;
  /** Grid card width in points. */
  width?: number;
};

export function ProductCard({ product, transit, myLocation, online, layout, width }: Props) {
  const source = myLocation ? otherLocation(myLocation) : null;
  const sourceStock = source ? product.stock[source] : 0;
  const inTransit = transit?.reduce((sum, t) => sum + t.quantity, 0) ?? 0;
  const photos = product.image_paths.length;

  const open = () => router.push({ pathname: '/product/[id]', params: { id: product.id } });
  const request = source ? (
    <Button
      title={sourceStock > 0 ? 'Request' : 'None left'}
      size="small"
      disabled={!online || sourceStock === 0}
      onPress={() => router.push({ pathname: '/request-new', params: { productId: product.id } })}
    />
  ) : null;

  const stock = (
    <View style={styles.stockRow}>
      {(['main_store', 'warehouse'] as const).map((loc) => (
        <Text key={loc} style={styles.stockText} numberOfLines={1}>
          {LOCATION_LABEL[loc]}{' '}
          <Text style={[styles.stockNumber, loc === myLocation && styles.mine]}>{product.stock[loc]}</Text>
        </Text>
      ))}
    </View>
  );

  const transitLine = inTransit > 0 ? <Text style={styles.transit}>{inTransit} in transit</Text> : null;

  if (layout === 'grid') {
    return (
      <Pressable onPress={open} style={({ pressed }) => [styles.gridCard, { width }, pressed && styles.pressed]}>
        <View>
          <ProductImage path={product.image_paths[0]} style={styles.gridImage} />
          {photos > 1 && <PhotoCount count={photos} />}
        </View>
        <View style={styles.gridBody}>
          <Text style={styles.name} numberOfLines={1}>
            {product.name}
          </Text>
          <View style={styles.gridStock}>
            {(['main_store', 'warehouse'] as const).map((loc) => (
              <View key={loc} style={styles.gridStockItem}>
                <Text style={styles.gridStockLabel} numberOfLines={1}>
                  {LOCATION_LABEL[loc]}
                </Text>
                <Text style={[styles.stockNumber, loc === myLocation && styles.mine]}>{product.stock[loc]}</Text>
              </View>
            ))}
          </View>
          {transitLine}
          {request}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={open} style={({ pressed }) => [styles.listCard, pressed && styles.pressed]}>
      <View>
        <ProductImage path={product.image_paths[0]} style={styles.thumb} />
        {photos > 1 && <PhotoCount count={photos} />}
      </View>
      <View style={styles.listBody}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>
        {stock}
        {transitLine}
      </View>
      {request}
    </Pressable>
  );
}

function PhotoCount({ count }: { count: number }) {
  return (
    <View style={styles.photoCount}>
      <Ionicons name="images-outline" size={11} color="#FFFFFF" />
      <Text style={styles.photoCountText}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  mine: { color: colors.champagneDark },
  transit: { fontSize: 13, color: '#4A5A75' },
  stockRow: { flexDirection: 'row', gap: space.md },
  stockText: { fontSize: 13, color: colors.muted },
  stockNumber: { fontSize: 15, fontWeight: '700', color: colors.text },

  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  thumb: { width: 64, height: 64, borderRadius: radius.sm },
  listBody: { flex: 1, gap: 3 },

  gridCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  gridImage: { width: '100%', aspectRatio: 1 },
  gridBody: { padding: 10, gap: 6 },
  gridStock: { flexDirection: 'row', gap: space.sm },
  gridStockItem: { flex: 1 },
  gridStockLabel: { fontSize: 11, color: colors.muted },

  photoCount: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(31,29,26,0.6)',
    borderRadius: radius.pill,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  photoCountText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
});
