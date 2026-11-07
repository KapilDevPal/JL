import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { OfflineBanner } from '@/components/OfflineBanner';
import { colors, radius, space, type } from '@/components/theme';
import { friendlyError } from '@/lib/errors';
import { useIsOnline } from '@/lib/network';
import { supabase } from '@/lib/supabase';
import { LOCATION_LABEL, type Location } from '@/lib/types';

export default function AssignEmployee() {
  const online = useIsOnline();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState<Location | null>(null);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);

  const valid = /\S+@\S+\.\S+/.test(email.trim()) && location !== null;

  const save = async () => {
    if (lock.current || !valid || !online) return;
    lock.current = true;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('admin_assign_employee', {
        p_email: email.trim(),
        p_location: location,
        p_display_name: name.trim() || null,
      });
      if (error) throw error;
      Alert.alert('Employee assigned', `${name.trim() || email.trim()} now works at ${LOCATION_LABEL[location!]}.`);
      setEmail('');
      setName('');
      setLocation(null);
    } catch (e) {
      Alert.alert('Could not assign employee', friendlyError(e));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <OfflineBanner />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={[type.small, styles.note]}>
          Create the employee's login in Supabase (Authentication → Users → Add user) first, then assign their location here.
        </Text>
        <Field
          label="Employee email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="off"
        />
        <Field
          label="Name shown on requests (optional)"
          value={name}
          onChangeText={setName}
          maxLength={80}
          autoCapitalize="words"
          placeholder="Leave blank to keep their current name"
        />
        <View style={styles.group}>
          <Text style={type.label}>Location</Text>
          <View style={styles.row}>
            {(['main_store', 'warehouse'] as const).map((loc) => (
              <Pressable
                key={loc}
                accessibilityRole="radio"
                accessibilityState={{ checked: location === loc }}
                onPress={() => setLocation(loc)}
                style={[styles.option, location === loc && styles.optionActive]}>
                <Text style={[styles.optionText, location === loc && styles.optionTextActive]}>{LOCATION_LABEL[loc]}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Button title="Assign" onPress={save} loading={saving} disabled={!online || !valid} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { padding: space.lg, gap: space.lg },
  note: { lineHeight: 19 },
  group: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  option: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionActive: { borderColor: colors.champagne, backgroundColor: colors.champagneSoft },
  optionText: { fontSize: 16, color: colors.muted, fontWeight: '600' },
  optionTextActive: { color: colors.champagneDark },
});
