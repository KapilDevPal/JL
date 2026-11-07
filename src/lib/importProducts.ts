import { File } from 'expo-file-system';
import * as XLSX from 'xlsx';

import type { Product } from './types';

export const MAX_IMPORT_ROWS = 1000;
const MAX_QTY = 999999;

export type ImportRow = {
  /** Row number as shown in the spreadsheet (header is row 1). */
  line: number;
  name: string;
  main_store: number;
  warehouse: number;
  /** The product this row will update, if the name already exists. */
  existing?: Product;
  error?: string;
};

export type ParsedImport = { fileName: string; rows: ImportRow[]; problem?: string };

// Accepted header spellings, compared lowercase with spaces/punctuation removed.
const COLUMNS = {
  name: ['name', 'product', 'productname', 'item', 'itemname'],
  main_store: ['mainstore', 'main', 'store', 'mainstorestock', 'mainstoreqty', 'mainstorequantity'],
  warehouse: ['warehouse', 'wh', 'warehousestock', 'warehouseqty', 'warehousequantity'],
} as const;

const normalise = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z]/g, '');

function parseQuantity(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0 && value <= MAX_QTY ? value : null;
  const text = String(value ?? '').replace(/[\s,]/g, '');
  if (text === '') return 0; // blank cell = none in stock
  return /^\d{1,6}$/.test(text) ? parseInt(text, 10) : null;
}

/** Opens the file picker. Returns null if the user cancels. */
export async function pickImportFile(): Promise<{ name: string; data: ArrayBuffer } | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['*/*'] });
  if (picked.canceled) return null;
  const file = picked.result;
  if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
    throw new Error('UNSUPPORTED_FILE');
  }
  return { name: file.name, data: await file.arrayBuffer() };
}

/** Reads the first sheet of a CSV or Excel file and checks every row. */
export function parseImport(fileName: string, data: ArrayBuffer, products: Product[]): ParsedImport {
  const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { fileName, rows: [], problem: 'The file is empty.' };

  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' });
  const header = (grid[0] ?? []).map(normalise);
  const col = {
    name: header.findIndex((h) => (COLUMNS.name as readonly string[]).includes(h)),
    main_store: header.findIndex((h) => (COLUMNS.main_store as readonly string[]).includes(h)),
    warehouse: header.findIndex((h) => (COLUMNS.warehouse as readonly string[]).includes(h)),
  };
  if (col.name < 0 || col.main_store < 0 || col.warehouse < 0) {
    return { fileName, rows: [], problem: 'The first row must contain the column names: Name, Main Store, Warehouse.' };
  }

  // Keep each row's spreadsheet line number (header = 1) before skipping blanks.
  const body = grid
    .slice(1)
    .map((cells, i) => ({ cells, line: i + 2 }))
    .filter(({ cells }) => cells.some((cell) => String(cell).trim() !== ''));
  if (body.length === 0) return { fileName, rows: [], problem: 'No products found under the column names.' };
  if (body.length > MAX_IMPORT_ROWS) {
    return { fileName, rows: [], problem: `A file can have up to ${MAX_IMPORT_ROWS} products. This one has ${body.length}.` };
  }

  const existingByName = new Map<string, Product[]>();
  for (const p of products) {
    const key = p.name.trim().toLowerCase();
    existingByName.set(key, [...(existingByName.get(key) ?? []), p]);
  }
  const seen = new Map<string, number>();

  const rows = body.map(({ cells: r, line }): ImportRow => {
    const name = String(r[col.name] ?? '').trim();
    const main = parseQuantity(r[col.main_store]);
    const warehouse = parseQuantity(r[col.warehouse]);
    const key = name.toLowerCase();
    const matches = existingByName.get(key) ?? [];
    const row: ImportRow = { line, name, main_store: main ?? 0, warehouse: warehouse ?? 0, existing: matches[0] };

    if (!name) row.error = 'Name is missing';
    else if (name.length > 120) row.error = 'Name is longer than 120 characters';
    else if (seen.has(key)) row.error = `Same name as row ${seen.get(key)}`;
    else if (matches.length > 1) row.error = 'More than one existing product has this name';
    else if (main === null) row.error = 'Main Store must be a whole number of 0 or more';
    else if (warehouse === null) row.error = 'Warehouse must be a whole number of 0 or more';

    if (name && !seen.has(key)) seen.set(key, line);
    return row;
  });

  return { fileName, rows };
}
