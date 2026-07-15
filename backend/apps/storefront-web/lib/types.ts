export interface Variant {
  id: string;
  sku: string;
  barcode: string | null;
  priceCents: number;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  images: string[];
  category: { id: string; name: string } | null;
  variants: Variant[];
}

export interface StoreLite {
  id: string;
  name: string;
  address: string | null;
  currency: string;
}

export interface Bootstrap {
  org: { id: string; name: string };
  stores: StoreLite[];
}

export interface OrderItem {
  id: string;
  variantId: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface Payment {
  id: string;
  status: string;
  method: string;
  amountCents: number;
}

export interface Order {
  id: string;
  status: string;
  fulfillmentType: string;
  subtotalCents: number;
  totalCents: number;
  createdAt: string;
  items: OrderItem[];
  payments: Payment[];
}
