/**
 * End-to-end smoke test for the Sellivo backend spine. Hits the running API over
 * HTTP and asserts the full flow: register -> catalog -> restock -> barcode scan
 * -> POS sync push (twice, to prove idempotency) -> ledger/stock -> online order
 * -> payment intent + webhook. Run with the API listening on :3000.
 */
const BASE = process.env.BASE ?? "http://localhost:3000/api";
let pass = 0;
let fail = 0;

function assert(cond, msg) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
}

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

const uuid = () => crypto.randomUUID();

async function main() {
  const suffix = Date.now();
  const email = `owner+${suffix}@acme.test`;

  console.log("\n[1] Auth");
  const reg = await api("POST", "/auth/register", {
    body: { organizationName: `Acme ${suffix}`, name: "Owner", email, password: "supersecret" },
  });
  assert(reg.status === 201 && reg.body.accessToken, "register returns tokens");
  const token = reg.body.accessToken;

  const me = await api("GET", "/auth/me", { token });
  assert(me.status === 200 && me.body.role === "owner", "me() returns owner");

  const noauth = await api("GET", "/auth/me");
  assert(noauth.status === 401, "unauthenticated request is rejected (401)");

  console.log("\n[2] Store + catalog");
  const store = await api("POST", "/stores", { token, body: { name: "MG Road" } });
  assert(store.status === 201 && store.body.id, "create store");
  const storeId = store.body.id;

  const product = await api("POST", "/products", {
    token,
    body: { name: "Cola 500ml", brand: "Acme" },
  });
  assert(product.status === 201, "create product");
  const productId = product.body.id;

  const barcode = `890${suffix}`;
  const variant = await api("POST", `/products/${productId}/variants`, {
    token,
    body: { sku: `COLA-${suffix}`, barcode, priceCents: 4000 },
  });
  assert(variant.status === 201 && variant.body.id, "create variant with barcode");
  const variantId = variant.body.id;

  const scan = await api("GET", `/variants/by-barcode/${barcode}`, { token });
  assert(scan.status === 200 && scan.body.id === variantId, "barcode lookup resolves variant");

  console.log("\n[3] Inventory restock (ledger)");
  const restock = await api("POST", "/inventory/movements", {
    token,
    body: { storeId, variantId, delta: 100, reason: "restock" },
  });
  assert(restock.status === 201 && restock.body.onHand === 100, "restock sets on-hand to 100");

  console.log("\n[4] POS sync push (offline sale) + idempotency");
  const clientUuid = uuid();
  const movementId = uuid();
  const salePayload = {
    deviceId: "till-1",
    sales: [
      {
        clientUuid,
        storeId,
        subtotalCents: 8000,
        totalCents: 8000,
        offlineCreatedAt: new Date().toISOString(),
        items: [
          { variantId, quantity: 2, unitPriceCents: 4000, totalCents: 8000, movementId },
        ],
      },
    ],
  };
  const push1 = await api("POST", "/pos/sync/push", { token, body: salePayload });
  assert(push1.status === 201 && push1.body.accepted === 1, "first push accepted (1 sale)");

  const push2 = await api("POST", "/pos/sync/push", { token, body: salePayload });
  assert(
    push2.status === 201 && push2.body.duplicates === 1 && push2.body.accepted === 0,
    "replaying same batch is a no-op (idempotent)",
  );
  assert(
    push1.body.saleIds[0] === push2.body.saleIds[0],
    "duplicate push maps to the same sale id",
  );

  console.log("\n[5] Verify stock decremented exactly once");
  const inv = await api("GET", `/stores/${storeId}/inventory`, { token });
  const row = inv.body.find((r) => r.variantId === variantId);
  assert(inv.status === 200 && row && row.onHand === 98, "on-hand is 98 (100 - 2), not double-counted");

  console.log("\n[6] Online order decrements stock + refuses oversell");
  const order = await api("POST", "/orders", {
    token,
    body: { storeId, fulfillmentType: "pickup", items: [{ variantId, quantity: 3 }] },
  });
  assert(order.status === 201 && order.body.totalCents === 12000, "order created, priced from variant");
  const orderId = order.body.id;

  const inv2 = await api("GET", `/stores/${storeId}/inventory`, { token });
  const row2 = inv2.body.find((r) => r.variantId === variantId);
  assert(row2.onHand === 95, "on-hand is 95 (98 - 3) after online order");

  const oversell = await api("POST", "/orders", {
    token,
    body: { storeId, fulfillmentType: "pickup", items: [{ variantId, quantity: 9999 }] },
  });
  assert(oversell.status === 400, "online order refuses on insufficient stock (400)");

  console.log("\n[7] Payments: intent -> webhook settles + confirms order");
  const intent = await api("POST", "/payments/intent", {
    token,
    body: { target: "order", orderId, method: "online" },
  });
  assert(intent.status === 201 && intent.body.gatewayRef, "payment intent created");

  const webhook = await api("POST", "/payments/webhook", {
    body: { gatewayRef: intent.body.gatewayRef, status: "paid" },
  });
  assert(webhook.status === 200 && webhook.body.ok, "webhook accepted (public, no auth)");

  const orderAfter = await api("GET", `/orders/${orderId}`, { token });
  assert(orderAfter.body.status === "confirmed", "order advanced to confirmed by webhook");
  assert(
    orderAfter.body.payments.some((p) => p.status === "paid"),
    "payment marked paid",
  );

  console.log("\n[8] Tenancy isolation");
  const other = await api("POST", "/auth/register", {
    body: { organizationName: `Other ${suffix}`, name: "O", email: `other+${suffix}@x.test`, password: "supersecret" },
  });
  const otherToken = other.body.accessToken;
  const leak = await api("GET", `/stores/${storeId}`, { token: otherToken });
  assert(leak.status === 404, "another org cannot read this org's store (404)");

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
