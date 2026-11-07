import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { OfflineBanner } from '@/components/OfflineBanner';
import { colors, space, type } from '@/components/theme';
import { useAuth } from '@/lib/auth';

export default function Unassigned() {
  const { session, profileError, refreshProfile, signOut } = useAuth();
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    await refreshProfile();
    setChecking(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <OfflineBanner />
      <View style={styles.body}>
        <Text style={type.title}>{profileError ? 'Could not load your account' : 'Almost ready'}</Text>
        <Text style={[type.body, styles.text]}>
          {profileError
            ? 'Check your internet connection and try again.'
            : `${session?.user.email ?? 'Your account'} is not assigned to a location yet. Ask your administrator to assign you to Main Store or Warehouse.`}
        </Text>
        <Button title="Check again" onPress={check} loading={checking} />
        <Button title="Sign out" variant="secondary" onPress={signOut} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, justifyContent: 'center', padding: space.lg, gap: space.md },
  text: { color: colors.muted, lineHeight: 23, marginBottom: space.md },
});
