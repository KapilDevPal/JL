import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ProductImage } from '@/components/ProductImage';
import { QuantityInput } from '@/components/QuantityInput';
import { colors, radius, space, type } from '@/components/theme';
import { useData } from '@/lib/data';
import { friendlyError, isError } from '@/lib/errors';
import { deleteProductImage, pickProductImage, uploadProductImage } from '@/lib/images';
import { useIsOnline } from '@/lib/network';
import { supabase } from '@/lib/supabase';
import type { Location } from '@/lib/types';

export default function ProductForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { productsById, refresh } = useData();
  const online = useIsOnline();
  const existing = id ? productsById.get(id) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [imagePath] = useState(existing?.image_path ?? null);
  const [localUri, setLocalUri] = useState<string | null>(null);
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
  const hasImage = !!(localUri || imagePath);

  const pick = async (source: 'camera' | 'library') => {
    if (picking) return;
    setPicking(true);
    try {
      const uri = await pickProductImage(source);
      if (uri) setLocalUri(uri);
    } catch (e) {
      Alert.alert('Could not use that photo', friendlyError(e));
    } finally {
      setPicking(false);
    }
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
    let uploaded: string | null = null;
    try {
      if (localUri) uploaded = await uploadProductImage(localUri);
      const { error } = await supabase.rpc('admin_save_product', {
        p_product_id: id ?? null,
        p_name: name.trim(),
        p_image_path: uploaded ?? imagePath,
        p_main_store_qty: main,
        p_warehouse_qty: warehouse,
        p_expected_main_store: expected?.main_store ?? null,
        p_expected_warehouse: expected?.warehouse ?? null,
      });
      if (error) throw error;
      // The old image is no longer referenced once the new one is saved.
      if (uploaded && imagePath) deleteProductImage(imagePath).catch(() => {});
      await refresh();
      router.back();
    } catch (e) {
      if (uploaded) deleteProductImage(uploaded).catch(() => {});
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
        <ProductImage localUri={localUri} path={imagePath} style={styles.image} />
        <View style={styles.row}>
          <Button
            title={hasImage ? 'Retake photo' : 'Take photo'}
            variant="secondary"
            style={styles.flex}
            disabled={picking || saving}
            onPress={() => pick('camera')}
          />
          <Button
            title={hasImage ? 'Replace photo' : 'Choose photo'}
            variant="secondary"
            style={styles.flex}
            disabled={picking || saving}
            onPress={() => pick('library')}
          />
        </View>

        <Field label="Product name" value={name} onChangeText={setName} maxLength={120} autoCapitalize="words" />

        <View style={styles.group}>
          <Text style={type.label}>Main Store stock</Text>
          <QuantityInput value={mainQty} onChange={setMainQty} label="Main Store stock" />
        </View>
        <View style={styles.group}>
          <Text style={type.label}>Warehouse stock</Text>
          <QuantityInput value={warehouseQty} onChange={setWarehouseQty} label="Warehouse stock" />
        </View>

        <Button title="Save" onPress={save} loading={saving} disabled={!online || !valid || picking} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { padding: space.lg, gap: space.lg, paddingBottom: space.xl },
  missing: { padding: space.lg },
  image: { width: '100%', aspectRatio: 1, borderRadius: radius.lg },
  row: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  group: { gap: space.sm },
});
