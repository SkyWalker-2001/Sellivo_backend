"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import { money } from "@/lib/config";

export default function CartPage() {
  const { lines, setQuantity, remove, subtotalCents } = useCart();

  if (lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-500">Your cart is empty.</p>
        <Link href="/" className="mt-4 inline-block text-brand hover:underline">
          Continue shopping →
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Your cart</h1>
      <div className="space-y-3">
        {lines.map((l) => (
          <div key={l.variantId} className="flex items-center gap-4 rounded-xl border bg-white p-4">
            <div className="flex-1">
              <p className="font-medium">{l.name}</p>
              <p className="text-sm text-gray-500">{money(l.priceCents)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(l.variantId, l.quantity - 1)}
                className="h-8 w-8 rounded-md border text-lg leading-none"
              >
                −
              </button>
              <span className="w-6 text-center">{l.quantity}</span>
              <button
                onClick={() => setQuantity(l.variantId, l.quantity + 1)}
                className="h-8 w-8 rounded-md border text-lg leading-none"
              >
                +
              </button>
            </div>
            <div className="w-20 text-right font-semibold">{money(l.priceCents * l.quantity)}</div>
            <button
              onClick={() => remove(l.variantId)}
              className="text-sm text-gray-400 hover:text-red-500"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between rounded-xl border bg-white p-4">
        <span className="text-lg">Subtotal</span>
        <span className="text-xl font-bold">{money(subtotalCents)}</span>
      </div>
      <Link
        href="/checkout"
        className="mt-4 block rounded-lg bg-brand py-3 text-center font-medium text-white hover:bg-brand-dark"
      >
        Proceed to checkout
      </Link>
    </div>
  );
}
