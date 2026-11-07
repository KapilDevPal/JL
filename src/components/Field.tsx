import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius, space, type } from './theme';

export function Field({ label, ...input }: { label: string } & TextInputProps) {
  return (
    <View style={styles.wrap}>
      <Text style={type.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} {...input} style={[styles.input, input.style]} />
    </View>
  );
}

export const inputStyle = {
  height: 52,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: colors.border,
  paddingHorizontal: space.md,
  fontSize: 16,
  color: colors.text,
  backgroundColor: colors.surface,
};

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  input: inputStyle,
});
