import { StyleSheet, Text, View } from 'react-native';

import { useIsOnline } from '@/lib/network';
import { colors, space } from './theme';

export function OfflineBanner() {
  const online = useIsOnline();
  if (online) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.text}>You are offline. Stock changes are paused until you reconnect.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.dangerSoft, paddingVertical: space.sm, paddingHorizontal: space.md },
  text: { color: colors.danger, fontSize: 14, textAlign: 'center' },
});
