import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { OfflineBanner } from '@/components/OfflineBanner';
import { colors, space, type } from '@/components/theme';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { useIsOnline } from '@/lib/network';

export default function SignIn() {
  const { signIn } = useAuth();
  const online = useIsOnline();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  const submit = async () => {
    if (lock.current || !email.trim() || !password) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <OfflineBanner />
      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={styles.mark} />
          <Text style={type.title}>Stock</Text>
          <Text style={type.label}>Sign in with your work email</Text>
        </View>

        <View style={styles.form}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={submit}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Button
            title="Sign in"
            onPress={submit}
            loading={busy}
            disabled={!online || !email.trim() || !password}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, justifyContent: 'center', padding: space.lg, gap: space.xl },
  header: { alignItems: 'center', gap: space.sm },
  mark: { width: 40, height: 3, borderRadius: 2, backgroundColor: colors.champagne, marginBottom: space.sm },
  form: { gap: space.md },
  error: { color: colors.danger, fontSize: 14 },
});
