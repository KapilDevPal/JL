import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { colors } from '@/components/theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { DataProvider } from '@/lib/data';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootStack />
    </AuthProvider>
  );
}

function RootStack() {
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  // Until the session and profile are known, stay on sign-in (hidden behind
  // the splash screen at launch) so the wrong screen never flashes.
  const signedIn = !!session && !loading;
  const isStaff = signedIn && !!profile && (profile.location !== null || profile.is_admin);
  const isAdmin = isStaff && !!profile?.is_admin;

  // These guards only choose which screens are reachable. Real enforcement
  // is Row Level Security and the checks inside the SQL functions.
  return (
    <DataProvider enabled={isStaff}>
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={signedIn && !isStaff}>
          <Stack.Screen name="unassigned" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={isStaff}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="request-new" options={{ presentation: 'modal', title: 'Request stock' }} />
          <Stack.Screen name="request/[id]" options={{ presentation: 'modal', title: 'Request' }} />
          <Stack.Protected guard={isAdmin}>
            <Stack.Screen name="product-form" options={{ presentation: 'modal', title: 'Product' }} />
            <Stack.Screen name="assign" options={{ presentation: 'modal', title: 'Assign employee' }} />
          </Stack.Protected>
        </Stack.Protected>
      </Stack>
    </DataProvider>
  );
}
