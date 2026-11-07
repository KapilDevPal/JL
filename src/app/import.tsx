import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { OfflineBanner } from '@/components/OfflineBanner';
import { colors, radius, space, type } from '@/components/theme';
import { useData } from '@/lib/data';
import { friendlyError } from '@/lib/errors';
import { parseImport, pickImportFile, type ImportRow, type ParsedImport } from '@/lib/importProducts';
import { useIsOnline } from '@/lib/network';
import { supabase } from '@/lib/supabase';

const PREVIEW_LIMIT = 200;

export default function ImportProducts() {
  const { products, refresh } = useData();
  const online = useIsOnline();
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const lock = useRef(false);

  const rows = parsed?.rows ?? [];
  const errors = rows.filter((r) => r.error);
  const updates = rows.filter((r) => !r.error && r.existing);
  const created = rows.length - errors.length - updates.length;
  const canImport = !!parsed && !parsed.problem && rows.length > 0 && errors.length === 0;

  const choose = async () => {
    if (reading) return;
    setReading(true);
    try {
      const file = await pickImportFile();
      if (file) setParsed(parseImport(file.name, file.data, products));
    } catch (e) {
      Alert.alert('Could not read that file', friendlyError(e));
    } finally {
      setReading(false);
    }
  };

  const runImport = async () => {
    if (lock.current || !canImport || !online) return;
    lock.current = true;
    setImporting(true);
    try {
      const { data, error } = await supabase.rpc('admin_import_products', {
        p_rows: rows.map((r) => ({ name: r.name, main_store: r.main_store, warehouse: r.warehouse })),
      });
      if (error) throw error;
      const result = data as { created: number; updated: number };
      await refresh();
      router.back();
      Alert.alert('Import complete', `${result.created} new products, ${result.updated} updated.`);
    } catch (e) {
      Alert.alert('Import failed', `${friendlyError(e)} Nothing was changed.`);
      lock.current = false;
      setImporting(false);
    }
  };

  const confirmImport = () => {
    if (updates.length === 0) return runImport();
    Alert.alert(
      'Replace stock numbers?',
      `${updates.length} existing product${updates.length === 1 ? '' : 's'} will have Main Store and Warehouse stock set to the numbers in the file.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Import', onPress: runImport },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <OfflineBanner />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[type.body, styles.intro]}>
          Add or update many products at once from a CSV or Excel file. The first row must have these columns:
        </Text>
        <View style={styles.example}>
          {[
            ['Name', 'Main Store', 'Warehouse'],
            ['Pearl Earrings', '12', '40'],
            ['Silver Chain', '5', '0'],
          ].map((cells, i) => (
            <View key={i} style={[styles.exampleRow, i === 0 && styles.exampleHead]}>
              {cells.map((c) => (
                <Text key={c} style={[styles.exampleCell, i === 0 && styles.exampleHeadText]}>
                  {c}
                </Text>
              ))}
            </View>
          ))}
        </View>
        <Text style={type.small}>
          Names that already exist get their stock replaced. New names become new products, and you can add photos to
          them afterwards with Edit. Nothing is saved until you tap Import.
        </Text>

        <Button
          title={parsed ? 'Choose a different file' : 'Choose file'}
          variant={parsed ? 'secondary' : 'primary'}
          onPress={choose}
          loading={reading}
          disabled={importing}
        />

        {parsed && (
          <View style={styles.preview}>
            <Text style={type.heading} numberOfLines={1}>
              {parsed.fileName}
            </Text>
            {parsed.problem ? (
              <Text style={styles.error}>{parsed.problem}</Text>
            ) : (
              <>
                <View style={styles.summary}>
                  <Summary label="New" value={created} />
                  <Summary label="Update" value={updates.length} />
                  <Summary label="Errors" value={errors.length} danger={errors.length > 0} />
                </View>
                {errors.length > 0 && (
                  <Text style={styles.error}>Fix the rows marked in red in your file, then choose it again.</Text>
                )}
                {(errors.length > 0 ? [...errors, ...rows.filter((r) => !r.error)] : rows)
                  .slice(0, PREVIEW_LIMIT)
                  .map((row) => (
                    <PreviewRow key={row.line} row={row} />
                  ))}
                {rows.length > PREVIEW_LIMIT && (
                  <Text style={type.small}>…and {rows.length - PREVIEW_LIMIT} more rows.</Text>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {canImport && (
        <View style={styles.footer}>
          <Button
            title={`Import ${rows.length} product${rows.length === 1 ? '' : 's'}`}
            onPress={confirmImport}
            loading={importing}
            disabled={!online}
          />
        </View>
      )}
    </View>
  );
}

function Summary({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <View style={[styles.summaryBox, danger && styles.summaryDanger]}>
      <Text style={[styles.summaryValue, danger && { color: colors.danger }]}>{value}</Text>
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

function PreviewRow({ row }: { row: ImportRow }) {
  let detail: string;
  if (row.error) detail = row.error;
  else if (row.existing)
    detail = `Update · Main Store ${row.existing.stock.main_store} → ${row.main_store} · Warehouse ${row.existing.stock.warehouse} → ${row.warehouse}`;
  else detail = `New · Main Store ${row.main_store} · Warehouse ${row.warehouse}`;

  return (
    <View style={[styles.row, row.error && styles.rowError]}>
      <Text style={styles.rowLine}>{row.line}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {row.name || '(no name)'}
        </Text>
        <Text style={[type.small, row.error && { color: colors.danger }]}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xl },
  intro: { lineHeight: 22 },
  example: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, overflow: 'hidden' },
  exampleRow: { flexDirection: 'row' },
  exampleHead: { backgroundColor: colors.champagneSoft },
  exampleCell: { flex: 1, paddingVertical: 6, paddingHorizontal: 8, fontSize: 13, color: colors.text },
  exampleHeadText: { fontWeight: '700' },
  preview: { gap: space.sm, marginTop: space.sm },
  summary: { flexDirection: 'row', gap: space.sm },
  summaryBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryDanger: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  summaryValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  error: { color: colors.danger, fontSize: 14 },
  row: {
    flexDirection: 'row',
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  rowError: { backgroundColor: colors.dangerSoft },
  rowLine: { width: 32, fontSize: 12, color: colors.muted, textAlign: 'right', paddingTop: 2 },
  rowBody: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: '600', color: colors.text },
  footer: { padding: space.md, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
});
