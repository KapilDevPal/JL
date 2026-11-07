export type Location = 'main_store' | 'warehouse';
export type RequestStatus = 'pending' | 'approved' | 'completed' | 'rejected';

export const LOCATION_LABEL: Record<Location, string> = {
  main_store: 'Main Store',
  warehouse: 'Warehouse',
};

export function otherLocation(location: Location): Location {
  return location === 'main_store' ? 'warehouse' : 'main_store';
}

export type Profile = {
  id: string;
  location: Location | null;
  is_admin: boolean;
};

export type Product = {
  id: string;
  name: string;
  image_path: string | null;
  created_at: string;
  stock: Record<Location, number>;
};

export type StockRequest = {
  id: string;
  product_id: string;
  quantity: number;
  /** Source: sends the stock, approves or rejects. */
  from_location: Location;
  /** Destination: asked for the stock, confirms receipt. */
  to_location: Location;
  status: RequestStatus;
  created_by: string;
  created_at: string;
  approved_at: string | null;
  completed_at: string | null;
};
