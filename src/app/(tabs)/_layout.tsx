import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space } from '@/components/theme';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { LOCATION_LABEL } from '@/lib/types';
import { canApprove, canReceive } from '@/lib/useRequestActions';

function AccountButton() {
  const { profile, session, signOut } = useAuth();
  const label = profile?.location ? LOCATION_LABEL[profile.location] : 'Admin';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Account, ${label}`}
      hitSlop={8}
      style={styles.chip}
      onPress={() =>
        Alert.alert(label, `Signed in as ${session?.user.email ?? ''}`, [
          { text: 'Close', style: 'cancel' },
          { text: 'Sign out', style: 'destructive', onPress: signOut },
        ])
      }>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

function HeaderIcon({ name, label, onPress }: { name: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={styles.icon}>
      <Ionicons name={name} size={24} color={colors.text} />
    </Pressable>
  );
}

export default function TabsLayout() {
  const { profile } = useAuth();
  const { requests } = useData();
  const location = profile?.location;
  const needsAction = requests.filter((r) => canApprove(r, location) || canReceive(r, location)).length;

  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontSize: 20, fontWeight: '600', color: colors.text },
        headerTitleAlign: 'left',
        tabBarActiveTintColor: colors.champagneDark,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Products',
          tabBarIcon: ({ focused, size }) => (
            <Ionicons name="diamond-outline" size={size} color={focused ? colors.champagneDark : colors.muted} />
          ),
          headerRight: () => (
            <View style={styles.headerRight}>
              {profile?.is_admin && (
                <>
                  <HeaderIcon name="person-add-outline" label="Assign employee" onPress={() => router.push('/assign')} />
                  <HeaderIcon name="cloud-upload-outline" label="Import products" onPress={() => router.push('/import')} />
                  <HeaderIcon name="add" label="Add product" onPress={() => router.push('/product-form')} />
                </>
              )}
              <AccountButton />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Requests',
          tabBarIcon: ({ focused, size }) => (
            <Ionicons name="swap-horizontal" size={size} color={focused ? colors.champagneDark : colors.muted} />
          ),
          tabBarBadge: needsAction > 0 ? needsAction : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.champagne, color: '#FFFFFF' },
          headerRight: () => (
            <View style={styles.headerRight}>
              {location && (
                <HeaderIcon name="qr-code-outline" label="Scan request QR code" onPress={() => router.push('/scan')} />
              )}
              <AccountButton />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginRight: space.md },
  icon: { padding: 6 },
  chip: {
    backgroundColor: colors.champagneSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { color: colors.champagneDark, fontSize: 14, fontWeight: '600' },
});
