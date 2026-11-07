import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ProductImage } from '@/components/ProductImage';
import { QuantityInput } from '@/components/QuantityInput';
import { colors, radius, space, type } from '@/components/theme';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { friendlyError } from '@/lib/errors';
import { useIsOnline } from '@/lib/network';
import { supabase } from '@/lib/supabase';
import { LOCATION_LABEL, otherLocation } from '@/lib/types';

export default function NewRequest() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { productsById, refresh } = useData();
  const { profile } = useAuth();
  const online = useIsOnline();
  const [quantity, setQuantity] = useState('1');
  const [sending, setSending] = useState(false);
  const lock = useRef(false);

  const product = productId ? productsById.get(productId) : undefined;
  const to = profile?.location;
  if (!product || !to) {
    return <Text style={[type.body, styles.missing]}>This product is not available.</Text>;
  }
  const from = otherLocation(to);
  const available = product.stock[from];
  const qty = parseInt(quantity, 10);
  const valid = Number.isInteger(qty) && qty >= 1 && qty <= available;

  const send = async () => {
    if (lock.current || !valid || !online) return;
    lock.current = true;
    setSending(true);
    try {
      const { error } = await supabase
        .from('requests')
        .insert({ product_id: product.id, quantity: qty, from_location: from, to_location: to });
      if (error) throw error;
      await refresh();
      router.back();
      Alert.alert('Request sent', `${LOCATION_LABEL[from]} will see it straight away.`);
    } catch (e) {
      Alert.alert('Could not send request', friendlyError(e));
      lock.current = false;
      setSending(false);
    }
  };

  return (
    <View style={styles.screen}>
      <OfflineBanner />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.product}>
          <ProductImage path={product.image_paths[0]} style={styles.image} />
          <View style={styles.flex}>
            <Text style={type.heading}>{product.name}</Text>
            <Text style={type.label}>
              {available} available at {LOCATION_LABEL[from]}
            </Text>
          </View>
        </View>

        <View style={styles.group}>
          <Text style={type.label}>How many do you need?</Text>
          <QuantityInput value={quantity} onChange={setQuantity} min={1} max={Math.max(1, available)} label="Quantity" />
          {!Number.isNaN(qty) && qty > available && (
            <Text style={styles.warn}>Only {available} available at {LOCATION_LABEL[from]}.</Text>
          )}
        </View>

        <Text style={[type.small, styles.note]}>
          {LOCATION_LABEL[from]} → {LOCATION_LABEL[to]}. Stock moves once {LOCATION_LABEL[from]} approves and you confirm
          it was received.
        </Text>

        <Button title="Request" onPress={send} loading={sending} disabled={!online || !valid} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { padding: space.lg, gap: space.lg },
  missing: { padding: space.lg },
  product: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  image: { width: 88, height: 88, borderRadius: radius.md },
  flex: { flex: 1, gap: 4 },
  group: { gap: space.sm },
  warn: { color: colors.danger, fontSize: 14 },
  note: { lineHeight: 19 },
});
