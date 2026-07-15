"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { money } from "@/lib/config";
import type { Product } from "@/lib/types";
import AddToCart from "./AddToCart";

export default function Catalog({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.brand ?? "").toLowerCase().includes(q) ||
        p.variants.some((v) => v.sku.toLowerCase().includes(q)),
    );
  }, [products, query]);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products…"
        className="mb-6 w-full rounded-lg border px-4 py-2.5 outline-none focus:border-brand"
      />
      {filtered.length === 0 ? (
        <p className="py-16 text-center text-gray-400">No products found.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => {
            const price = p.variants[0]?.priceCents ?? 0;
            return (
              <div key={p.id} className="flex flex-col rounded-xl border bg-white p-3">
                <Link href={`/products/${p.id}`} className="block">
                  <div className="mb-3 aspect-square overflow-hidden rounded-lg bg-gray-100">
                    {p.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl text-gray-300">
                        🛍️
                      </div>
                    )}
                  </div>
                  <h3 className="line-clamp-1 font-medium">{p.name}</h3>
                  <p className="text-xs text-gray-500">{p.brand ?? "—"}</p>
                </Link>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <span className="font-semibold">{money(price)}</span>
                  <AddToCart product={p} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
