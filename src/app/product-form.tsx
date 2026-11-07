import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ProductImage } from '@/components/ProductImage';
import { QuantityInput } from '@/components/QuantityInput';
import { colors, radius, space, type } from '@/components/theme';
import { useData } from '@/lib/data';
import { friendlyError, isError } from '@/lib/errors';
import {
  deleteProductImages,
  MAX_IMAGES,
  pickProductImage,
  uploadProductImage,
  type PickedImage,
} from '@/lib/images';
import { useIsOnline } from '@/lib/network';
import { supabase } from '@/lib/supabase';
import type { Location } from '@/lib/types';

/** A photo already in storage (path) or newly picked and not yet uploaded. */
type Photo = { key: string; path?: string; picked?: PickedImage };

export default function ProductForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { productsById, refresh } = useData();
  const online = useIsOnline();
  const existing = id ? productsById.get(id) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [photos, setPhotos] = useState<Photo[]>(() =>
    (existing?.image_paths ?? []).map((path) => ({ key: path, path })),
  );
  const originalPaths = useRef(existing?.image_paths ?? []);
  const [mainQty, setMainQty] = useState(String(existing?.stock.main_store ?? 0));
  const [warehouseQty, setWarehouseQty] = useState(String(existing?.stock.warehouse ?? 0));
  // Stock as the admin saw it when the form opened. The server refuses the
  // save if real stock has moved since, so a stale form can't overwrite it.
  const [expected, setExpected] = useState(existing ? { ...existing.stock } : null);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const lock = useRef(false);

  if (id && !existing) {
    return <Text style={[type.body, styles.missing]}>This product is no longer available.</Text>;
  }

  const main = parseInt(mainQty, 10);
  const warehouse = parseInt(warehouseQty, 10);
  const valid = name.trim().length > 0 && main >= 0 && warehouse >= 0;
  const full = photos.length >= MAX_IMAGES;

  const pick = async (source: 'camera' | 'library') => {
    if (picking || full) return;
    setPicking(true);
    try {
      const image = await pickProductImage(source);
      if (image) setPhotos((list) => [...list, { key: image.uri, picked: image }]);
    } catch (e) {
      Alert.alert('Could not use that photo', friendlyError(e));
    } finally {
      setPicking(false);
    }
  };

  const photoOptions = (photo: Photo, index: number) => {
    const buttons = [
      { text: 'Cancel', style: 'cancel' as const },
      ...(index > 0
        ? [{ text: 'Make cover photo', onPress: () => setPhotos((l) => [photo, ...l.filter((p) => p !== photo)]) }]
        : []),
      { text: 'Remove', style: 'destructive' as const, onPress: () => setPhotos((l) => l.filter((p) => p !== photo)) },
    ];
    Alert.alert(index === 0 ? 'Cover photo' : 'Photo', undefined, buttons);
  };

  const reloadStock = async () => {
    if (!id) return;
    const { data } = await supabase.from('inventory').select('location, quantity').eq('product_id', id);
    const latest: Record<Location, number> = { main_store: 0, warehouse: 0 };
    for (const row of (data ?? []) as { location: Location; quantity: number }[]) latest[row.location] = row.quantity;
    setExpected(latest);
    setMainQty(String(latest.main_store));
    setWarehouseQty(String(latest.warehouse));
  };

  const save = async () => {
    if (lock.current || !valid || !online) return;
    lock.current = true;
    setSaving(true);
    const uploadedNow: string[] = [];
    try {
      const paths: string[] = [];
      for (const photo of photos) {
        if (photo.path) {
          paths.push(photo.path);
        } else if (photo.picked) {
          const path = await uploadProductImage(photo.picked);
          uploadedNow.push(path);
          paths.push(path);
        }
      }
      const { error } = await supabase.rpc('admin_save_product', {
        p_product_id: id ?? null,
        p_name: name.trim(),
        p_image_paths: paths,
        p_main_store_qty: main,
        p_warehouse_qty: warehouse,
        p_expected_main_store: expected?.main_store ?? null,
        p_expected_warehouse: expected?.warehouse ?? null,
      });
      if (error) throw error;
      // Photos removed in this edit are no longer referenced.
      deleteProductImages(originalPaths.current.filter((p) => !paths.includes(p))).catch(() => {});
      await refresh();
      router.back();
    } catch (e) {
      deleteProductImages(uploadedNow).catch(() => {});
      if (isError(e, 'STOCK_CHANGED')) await reloadStock();
      Alert.alert('Could not save product', friendlyError(e));
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: existing ? 'Edit product' : 'Add product' }} />
      <OfflineBanner />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.group}>
          <Text style={type.label}>
            Photos ({photos.length}/{MAX_IMAGES}){photos.length > 1 ? '. Tap a photo to make it the cover or remove it.' : ''}
          </Text>
          <View style={styles.photoGrid}>
            {photos.map((photo, index) => (
              <Pressable
                key={photo.key}
                accessibilityRole="button"
                accessibilityLabel={index === 0 ? 'Cover photo options' : `Photo ${index + 1} options`}
                onPress={() => photoOptions(photo, index)}
                disabled={saving}>
                <ProductImage path={photo.path} localUri={photo.picked?.uri} style={styles.photo} />
                {index === 0 && (
                  <View style={styles.coverBadge}>
                    <Text style={styles.coverText}>Cover</Text>
                  </View>
                )}
              </Pressable>
            ))}
            {!full && (
              <>
                <AddTile icon="camera-outline" label="Camera" disabled={picking || saving} onPress={() => pick('camera')} />
                <AddTile icon="images-outline" label="Gallery" disabled={picking || saving} onPress={() => pick('library')} />
              </>
            )}
          </View>
        </View>

        <Field label="Product name" value={name} onChangeText={setName} maxLength={120} autoCapitalize="words" />

        <View style={styles.qtyRow}>
          <View style={styles.qtyCol}>
            <Text style={type.label}>Main Store stock</Text>
            <QuantityInput value={mainQty} onChange={setMainQty} label="Main Store stock" />
          </View>
          <View style={styles.qtyCol}>
            <Text style={type.label}>Warehouse stock</Text>
            <QuantityInput value={warehouseQty} onChange={setWarehouseQty} label="Warehouse stock" />
          </View>
        </View>

        <Button title="Save" onPress={save} loading={saving} disabled={!online || !valid || picking} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AddTile({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'camera-outline' | 'images-outline';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add photo from ${label.toLowerCase()}`}
      disabled={disabled}
      onPress={onPress}
      style={[styles.photo, styles.addTile, disabled && styles.disabled]}>
      <Ionicons name={icon} size={24} color={colors.champagneDark} />
      <Text style={styles.addText}>{label}</Text>
    </Pressable>
  );
}

const PHOTO = 92;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { padding: space.lg, gap: space.lg, paddingBottom: space.xl },
  missing: { padding: space.lg },
  group: { gap: space.sm },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  photo: { width: PHOTO, height: PHOTO, borderRadius: radius.sm },
  addTile: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.champagne,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addText: { fontSize: 12, color: colors.champagneDark, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  coverBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    backgroundColor: 'rgba(31,29,26,0.6)',
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  coverText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  qtyRow: { gap: space.lg },
  qtyCol: { gap: space.sm },
});
