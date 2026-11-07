import { StyleSheet, Text, View } from 'react-native';

import type { RequestStatus } from '@/lib/types';
import { colors, radius } from './theme';

export const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: 'Waiting',
  approved: 'In transit',
  completed: 'Received',
  rejected: 'Rejected',
};

const STATUS_COLOURS: Record<RequestStatus, { bg: string; fg: string }> = {
  pending: { bg: colors.champagneSoft, fg: colors.champagneDark },
  approved: { bg: '#EEF1F6', fg: '#4A5A75' },
  completed: { bg: colors.successSoft, fg: colors.success },
  rejected: { bg: colors.dangerSoft, fg: colors.danger },
};

export function StatusPill({ status }: { status: RequestStatus }) {
  const c = STATUS_COLOURS[status];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  text: { fontSize: 13, fontWeight: '600' },
});
