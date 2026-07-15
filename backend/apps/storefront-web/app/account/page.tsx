"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { getOrders } from "@/lib/api";
import { money } from "@/lib/config";
import type { Order } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  confirmed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function AccountPage() {
  const { ready, customer, token } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      getOrders(token)
        .then(setOrders)
        .catch((e) => setError((e as Error).message));
    }
  }, [token]);

  if (!ready) return <p className="py-16 text-center text-gray-400">Loading…</p>;

  if (!customer) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-600">Sign in to see your orders.</p>
        <Link href="/login" className="mt-4 inline-block text-brand hover:underline">
          Sign in →
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">My orders</h1>
      <p className="mb-6 text-gray-500">Signed in as {customer.email}</p>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {orders === null ? (
        <p className="text-gray-400">Loading orders…</p>
      ) : orders.length === 0 ? (
        <p className="py-12 text-center text-gray-400">No orders yet.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-xl border bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Order #{o.id.slice(0, 8)}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    STATUS_COLORS[o.status] ?? "bg-gray-100 text-gray-700"
                  }`}
                >
                  {o.status}
                </span>
              </div>
              <div className="mt-2 text-sm text-gray-500">
                {o.items.length} item(s) • {o.fulfillmentType} •{" "}
                {new Date(o.createdAt).toLocaleString()}
              </div>
              <div className="mt-2 font-semibold">{money(o.totalCents)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
