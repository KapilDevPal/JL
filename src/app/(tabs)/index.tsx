import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { inputStyle } from '@/components/Field';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ProductCard, type CardLayout } from '@/components/ProductCard';
import { colors, radius, space, type } from '@/components/theme';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { useIsOnline } from '@/lib/network';

const LAYOUT_KEY = 'products.layout';
const GAP = 12;

function savedLayout(): CardLayout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
}

export default function Products() {
  const { products, inTransit, loading, error, refresh } = useData();
  const { profile } = useAuth();
  const online = useIsOnline();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [layout, setLayout] = useState<CardLayout>(savedLayout);

  const gridWidth = (width - space.md * 2 - GAP) / 2;

  const toggleLayout = () => {
    const next = layout === 'list' ? 'grid' : 'list';
    setLayout(next);
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      // Remembering the choice is only a convenience.
    }
  };

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
      <View style={styles.toolbar}>
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={layout === 'list' ? 'Show as grid' : 'Show as list'}
          onPress={toggleLayout}
          style={styles.toggle}>
          <Ionicons name={layout === 'list' ? 'grid-outline' : 'list-outline'} size={22} color={colors.text} />
        </Pressable>
      </View>

      {loading && products.length === 0 ? (
        <ActivityIndicator style={styles.center} color={colors.champagne} />
      ) : (
        <FlatList
          key={layout}
          data={filtered}
          numColumns={layout === 'grid' ? 2 : 1}
          columnWrapperStyle={layout === 'grid' ? styles.gridRow : undefined}
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
              online={online}
              layout={layout}
              width={gridWidth}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { marginTop: space.xl },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.sm },
  searchWrap: { flex: 1, justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 14, zIndex: 1 },
  search: { paddingLeft: 40, borderRadius: radius.pill, height: 44 },
  toggle: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { padding: space.md, gap: GAP, paddingBottom: space.xl },
  gridRow: { gap: GAP },
  error: { color: colors.danger, marginBottom: space.sm },
  empty: { alignItems: 'center', marginTop: space.xl, gap: space.md },
  emptyButton: { alignSelf: 'stretch' },
});
