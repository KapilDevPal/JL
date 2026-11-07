import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, space } from './theme';

type Props = {
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  label?: string;
};

/** Whole-number input with large − and + buttons. Keeps the raw text so the field can be cleared while typing. */
export function QuantityInput({ value, onChange, min = 0, max = 100000, label }: Props) {
  const n = parseInt(value, 10);
  const current = Number.isNaN(n) ? min : n;
  const set = (next: number) => onChange(String(Math.max(min, Math.min(max, next))));

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease${label ? ` ${label}` : ''}`}
        style={styles.step}
        disabled={current <= min}
        onPress={() => set(current - 1)}>
        <Text style={[styles.stepText, current <= min && styles.dim]}>−</Text>
      </Pressable>
      <TextInput
        accessibilityLabel={label}
        style={styles.input}
        keyboardType="number-pad"
        value={value}
        maxLength={6}
        onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ''))}
        onBlur={() => set(current)}
        selectTextOnFocus
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase${label ? ` ${label}` : ''}`}
        style={styles.step}
        disabled={current >= max}
        onPress={() => set(current + 1)}>
        <Text style={[styles.stepText, current >= max && styles.dim]}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  step: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 24, color: colors.text },
  dim: { color: colors.border },
  input: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
});
