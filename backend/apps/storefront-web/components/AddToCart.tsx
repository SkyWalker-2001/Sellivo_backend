"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/types";

export default function AddToCart({ product }: { product: Product }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const variant = product.variants[0];

  if (!variant) {
    return <p className="text-sm text-gray-400">Unavailable</p>;
  }

  return (
    <button
      onClick={() => {
        add({
          variantId: variant.id,
          productId: product.id,
          name: product.name,
          priceCents: variant.priceCents,
        });
        setAdded(true);
        setTimeout(() => setAdded(false), 1200);
      }}
      className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
    >
      {added ? "Added ✓" : "Add to cart"}
    </button>
  );
}
