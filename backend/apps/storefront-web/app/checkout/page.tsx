"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { checkout, confirmPayment } from "@/lib/api";
import { money } from "@/lib/config";

export default function CheckoutPage() {
  const { ready, customer, token, stores } = useAuth();
  const { lines, subtotalCents, clear } = useCart();
  const [fulfillment, setFulfillment] = useState("pickup");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  if (!ready) return <p className="py-16 text-center text-gray-400">Loading…</p>;

  if (!customer) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-600">Please sign in to check out.</p>
        <Link href="/login" className="mt-4 inline-block text-brand hover:underline">
          Sign in →
        </Link>
      </div>
    );
  }

  if (orderId) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="text-5xl">✅</div>
        <h1 className="mt-4 text-2xl font-bold">Order placed & paid</h1>
        <p className="mt-2 text-gray-500">Order #{orderId.slice(0, 8)} is confirmed.</p>
        <Link href="/account" className="mt-6 inline-block text-brand hover:underline">
          View my orders →
        </Link>
      </div>
    );
  }

  const store = stores[0];

  async function placeOrder() {
    if (!token || !store) return;
    setBusy(true);
    setError(null);
    try {
      const { order, payment } = await checkout(token, {
        storeId: store.id,
        fulfillmentType: fulfillment,
        items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      });
      // Razorpay-shaped: in production the gateway SDK confirms and the webhook
      // settles. Locally we confirm via the dev endpoint (source of truth stays
      // server-side).
      await confirmPayment(payment.gatewayRef);
      clear();
      setOrderId(order.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

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
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">Checkout</h1>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 font-semibold">Fulfillment</h2>
        {store && <p className="mb-3 text-sm text-gray-500">Store: {store.name}</p>}
        <div className="flex gap-3">
          {["pickup", "delivery"].map((f) => (
            <button
              key={f}
              onClick={() => setFulfillment(f)}
              className={`flex-1 rounded-lg border py-2 capitalize ${
                fulfillment === f ? "border-brand bg-brand/5 text-brand" : ""
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-white p-4">
        <h2 className="mb-3 font-semibold">Summary</h2>
        {lines.map((l) => (
          <div key={l.variantId} className="flex justify-between py-1 text-sm">
            <span>
              {l.name} × {l.quantity}
            </span>
            <span>{money(l.priceCents * l.quantity)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t pt-2 font-bold">
          <span>Total</span>
          <span>{money(subtotalCents)}</span>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      <button
        onClick={placeOrder}
        disabled={busy}
        className="mt-6 w-full rounded-lg bg-brand py-3 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {busy ? "Placing order…" : `Pay ${money(subtotalCents)}`}
      </button>
    </div>
  );
}
