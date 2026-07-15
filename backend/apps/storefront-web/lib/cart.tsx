"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export interface CartLine {
  variantId: string;
  productId: string;
  name: string;
  priceCents: number;
  quantity: number;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotalCents: number;
  add: (line: Omit<CartLine, "quantity">) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "sellivo.cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, hydrated]);

  const value = useMemo<CartContextValue>(() => {
    return {
      lines,
      count: lines.reduce((s, l) => s + l.quantity, 0),
      subtotalCents: lines.reduce((s, l) => s + l.priceCents * l.quantity, 0),
      add: (line) =>
        setLines((cur) => {
          const i = cur.findIndex((l) => l.variantId === line.variantId);
          if (i >= 0) {
            const copy = [...cur];
            copy[i] = { ...copy[i], quantity: copy[i].quantity + 1 };
            return copy;
          }
          return [...cur, { ...line, quantity: 1 }];
        }),
      setQuantity: (variantId, quantity) =>
        setLines((cur) =>
          quantity <= 0
            ? cur.filter((l) => l.variantId !== variantId)
            : cur.map((l) => (l.variantId === variantId ? { ...l, quantity } : l)),
        ),
      remove: (variantId) => setLines((cur) => cur.filter((l) => l.variantId !== variantId)),
      clear: () => setLines([]),
    };
  }, [lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
