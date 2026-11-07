import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { colors, radius, space, type } from '@/components/theme';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { parseRequestQr } from '@/lib/requestQr';
import { LOCATION_LABEL } from '@/lib/types';
import { canApprove, canReceive } from '@/lib/useRequestActions';

export default function ScanRequest() {
  const [permission, requestPermission] = useCameraPermissions();
  const { requests, refresh } = useData();
  const { profile } = useAuth();
  const [checking, setChecking] = useState(false);
  const handling = useRef(false);

  const done = () => {
    handling.current = false;
    setChecking(false);
  };

  const onScan = async (data: string) => {
    if (handling.current) return; // the camera reports the same code many times a second
    handling.current = true;
    const id = parseRequestQr(data);
    if (!id) {
      Alert.alert('Not a request QR code', 'Scan the QR code shown on a request in this app.', [{ text: 'OK', onPress: done }]);
      return;
    }
    setChecking(true);
    const request = requests.find((r) => r.id === id);
    if (!request) {
      // Created moments ago and not loaded yet: reload, and the request screen fills in when it arrives.
      refresh();
      router.replace({ pathname: '/request/[id]', params: { id, scanned: '1' } });
      return;
    }
    const myLocation = profile?.location ?? null;
    if (!canApprove(request, myLocation) && !canReceive(request, myLocation)) {
      const message =
        request.status === 'pending'
          ? `This request is waiting for ${LOCATION_LABEL[request.from_location]} to approve.`
          : request.status === 'approved'
            ? `This request is waiting for ${LOCATION_LABEL[request.to_location]} to confirm receipt.`
            : 'This request is already finished.';
      Alert.alert('Nothing for you to do', message, [
        { text: 'Scan again', onPress: done },
        { text: 'Open request', onPress: () => router.replace({ pathname: '/request/[id]', params: { id } }) },
      ]);
      return;
    }
    router.replace({ pathname: '/request/[id]', params: { id, scanned: '1' } });
  };

  if (!permission) return <View style={styles.screen} />;

  if (!permission.granted) {
    return (
      <View style={[styles.screen, styles.ask]}>
        <Text style={type.heading}>Camera needed</Text>
        <Text style={[type.body, styles.askText]}>Allow the camera to scan the QR code on a request.</Text>
        <Button title="Allow camera" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={checking ? undefined : ({ data }) => onScan(data)}
      />
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.frame} />
        <Text style={styles.hint}>{checking ? 'Opening request…' : 'Point at the QR code on the other phone'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  ask: { backgroundColor: colors.background, justifyContent: 'center', padding: space.lg, gap: space.md },
  askText: { color: colors.muted },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  frame: { width: 240, height: 240, borderRadius: radius.lg, borderWidth: 3, borderColor: colors.champagne },
  hint: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
});
