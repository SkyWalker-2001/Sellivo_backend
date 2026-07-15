import { API_URL } from "./config";
import type { Bootstrap, Order, Product } from "./types";

/** Low-level fetch with optional bearer token. Throws on non-2xx. */
async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string; cache?: RequestCache } = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: opts.cache ?? "no-store",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.message
      ? Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message
      : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

// ── Public (server or client) ──────────────────────────────────────────────
export const getBootstrap = () => request<Bootstrap>("/storefront/bootstrap");

export const getProducts = (orgId: string) =>
  request<Product[]>(`/storefront/orgs/${orgId}/products`);

export const getProduct = (orgId: string, id: string) =>
  request<Product>(`/storefront/orgs/${orgId}/products/${id}`);

// ── Customer auth ────────────────────────────────────────────────────────────
export const customerRegister = (orgId: string, body: { name: string; email: string; password: string }) =>
  request<{ accessToken: string }>(`/storefront/orgs/${orgId}/auth/register`, { method: "POST", body });

export const customerLogin = (orgId: string, body: { email: string; password: string }) =>
  request<{ accessToken: string }>(`/storefront/orgs/${orgId}/auth/login`, { method: "POST", body });

export const customerMe = (token: string) =>
  request<{ id: string; name: string; email: string }>("/storefront/auth/me", { token });

// ── Checkout & orders (customer) ──────────────────────────────────────────────
export const checkout = (
  token: string,
  body: { storeId: string; fulfillmentType: string; items: { variantId: string; quantity: number }[] },
) => request<{ order: Order; payment: { gatewayRef: string; amountCents: number } }>("/storefront/checkout", {
  method: "POST",
  body,
  token,
});

export const confirmPayment = (gatewayRef: string) =>
  request<{ ok: boolean }>("/storefront/payments/confirm", {
    method: "POST",
    body: { gatewayRef, status: "paid" },
  });

export const getOrders = (token: string) => request<Order[]>("/storefront/orders", { token });
