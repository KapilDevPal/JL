import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { friendlyError } from './errors';
import { useIsOnline } from './network';
import { supabase } from './supabase';
import type { Location, Product, StockRequest } from './types';

const HISTORY_LIMIT = 100;

export type Transit = { quantity: number; to: Location }[];

type DataState = {
  products: Product[];
  requests: StockRequest[];
  productsById: Map<string, Product>;
  /** Approved (sent) but not yet received, per product. */
  inTransit: Map<string, Transit>;
  /** Display name for a user id ("Unknown" if not found). */
  nameOf: (userId: string | null | undefined) => string;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const DataContext = createContext<DataState | null>(null);

type ProductRow = Omit<Product, 'stock'> & {
  inventory: { location: Location; quantity: number }[] | null;
};

function toProduct(row: ProductRow): Product {
  const stock: Record<Location, number> = { main_store: 0, warehouse: 0 };
  for (const item of row.inventory ?? []) stock[item.location] = item.quantity;
  return { id: row.id, name: row.name, image_paths: row.image_paths ?? [], created_at: row.created_at, stock };
}

async function fetchAll() {
  const [products, open, history, people] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, image_paths, created_at, inventory(location, quantity)')
      .order('name'),
    supabase
      .from('requests')
      .select('*')
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false }),
    supabase
      .from('requests')
      .select('*')
      .in('status', ['completed', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase.from('profiles').select('id, display_name'),
  ]);
  const error = products.error ?? open.error ?? history.error ?? people.error;
  if (error) throw error;
  return {
    products: ((products.data ?? []) as ProductRow[]).map(toProduct),
    requests: [...(open.data ?? []), ...(history.data ?? [])] as StockRequest[],
    names: new Map(
      ((people.data ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name]),
    ),
  };
}

/**
 * Holds products, stock and requests for the signed-in employee and keeps
 * them fresh: Realtime changes, reconnects, coming back online and returning
 * to the app all trigger a full (cheap) reload, so no event can be missed.
 */
export function DataProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [names, setNames] = useState<Map<string, string | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const online = useIsOnline();

  const inFlight = useRef<Promise<void> | null>(null);
  const runAgain = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Coalesces overlapping calls; a call made mid-load triggers one more load
  // so the final state always reflects the latest database state.
  const refresh = useCallback((): Promise<void> => {
    if (inFlight.current) {
      runAgain.current = true;
      return inFlight.current;
    }
    const run = (async () => {
      try {
        do {
          runAgain.current = false;
          const next = await fetchAll();
          if (!enabledRef.current) return;
          setProducts(next.products);
          setRequests(next.requests);
          setNames(next.names);
          setError(null);
        } while (runAgain.current);
      } catch (e) {
        setError(friendlyError(e));
      } finally {
        setLoading(false);
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, []);

  // Initial load, and clear everything on sign-out.
  useEffect(() => {
    if (enabled) {
      setLoading(true);
      refresh();
    } else {
      setProducts([]);
      setRequests([]);
      setError(null);
    }
  }, [enabled, refresh]);

  // Realtime subscription with backoff reconnect.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const onChange = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(refresh, 250);
    };

    const connect = (attempt: number) => {
      const current = supabase
        .channel(`stock-sync-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, onChange);
      channel = current;
      current.subscribe((status) => {
        if (cancelled || channel !== current) return;
        if (status === 'SUBSCRIBED') {
          attempt = 0;
          refresh(); // catch up on anything missed while disconnected
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          channel = null;
          supabase.removeChannel(current);
          retryTimer = setTimeout(() => connect(attempt + 1), Math.min(30_000, 1000 * 2 ** attempt));
        }
      });
    };

    connect(0);
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      clearTimeout(debounceTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [enabled, refresh]);

  // Reload when the connection comes back.
  const wasOnline = useRef(online);
  useEffect(() => {
    if (enabled && online && !wasOnline.current) refresh();
    wasOnline.current = online;
  }, [enabled, online, refresh]);

  // Reload when the app returns to the foreground.
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [enabled, refresh]);

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const nameOf = useCallback(
    (userId: string | null | undefined) => (userId && names.get(userId)) || 'Unknown',
    [names],
  );

  const inTransit = useMemo(() => {
    const map = new Map<string, Transit>();
    for (const r of requests) {
      if (r.status !== 'approved') continue;
      const list = map.get(r.product_id) ?? [];
      list.push({ quantity: r.quantity, to: r.to_location });
      map.set(r.product_id, list);
    }
    return map;
  }, [requests]);

  return (
    <DataContext.Provider value={{ products, requests, productsById, inTransit, nameOf, loading, error, refresh }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataState {
  const value = useContext(DataContext);
  if (!value) throw new Error('useData must be used inside DataProvider');
  return value;
}
