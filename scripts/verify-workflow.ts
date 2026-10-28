/**
 * Live end-to-end verification against a RUNNING server.
 *
 *   npm run dev            # terminal 1 (fresh db: npm run db:setup)
 *   npx tsx scripts/verify-workflow.ts [http://127.0.0.1:3000]
 *
 * Exercises the real HTTP surface with cookies: staff login -> pairing code ->
 * device pairing -> menu -> order -> duplicate submission -> kitchen ticket
 * lifecycle -> payment -> reports -> role isolation. Prints PASS/FAIL per step
 * and exits non-zero on failure.
 */
const BASE = process.argv[2] ?? "http://127.0.0.1:3000";

let failures = 0;
function check(name: string, condition: boolean, details?: unknown) {
  if (condition) {
    console.log(`PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${name}`, details ?? "");
  }
}

class Session {
  cookie = "";
  async request<T = unknown>(
    path: string,
    init: RequestInit = {},
  ): Promise<{ status: number; json: T; text: string }> {
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...init.headers,
      },
      redirect: "manual",
    });
    const setCookie = response.headers.getSetCookie?.() ?? [];
    for (const raw of setCookie) {
      const [pair] = raw.split(";");
      if (pair) this.cookie = pair;
    }
    const text = await response.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: response.status, json: json as T, text };
  }
}

async function main() {
  const anon = new Session();
  const cashier = new Session();
  const kitchen = new Session();
  const device = new Session();

  const health = await anon.request("/api/health");
  check("health endpoint reports database up", health.status === 200);

  const login = await cashier.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "kassir@lolacafe.uz", password: "lola-cashier-2026" }),
  });
  check("cashier login", login.status === 200, login.json);

  const badLogin = await new Session().request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "kassir@lolacafe.uz", password: "definitely-wrong" }),
  });
  check("wrong password is rejected with 401", badLogin.status === 401);

  const tables = await cashier.request<{ tables: Array<{ id: number }> }>("/api/staff/tables");
  const tableId = tables.json.tables[0]!.id;

  const pairing = await cashier.request<{ pairing: { code: string } }>(
    `/api/staff/tables/${tableId}/pairing-code`,
    { method: "POST" },
  );
  const code = pairing.json.pairing.code;
  check("pairing code issued", pairing.status === 201 && /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code), code);

  const paired = await device.request("/api/table/pair", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  check("device paired", paired.status === 200, paired.json);

  const reuse = await new Session().request("/api/table/pair", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  check("pairing code is single-use", reuse.status === 422);

  const unpaired = await new Session().request("/api/table/menu");
  check("menu requires a paired device", unpaired.status === 401);

  const menu = await device.request<{ products: Array<{ id: number; nameUz: string; priceTiyin: number }> }>(
    "/api/table/menu",
  );
  const coffee = menu.json.products.find((product) => product.nameUz === "Kapuchino")!;
  check("menu returned to paired device", Boolean(coffee));

  const clientRequestId = `verify-${Date.now()}`;
  const created = await device.request<{
    order: { id: number; totalTiyin: number; items: Array<{ unitPriceTiyin: number }> };
  }>("/api/table/orders", {
    method: "POST",
    body: JSON.stringify({
      items: [{ productId: coffee.id, quantity: 2, optionIds: [], priceTiyin: 1 }],
      clientRequestId,
    }),
  });
  const order = created.json.order;
  check("order persisted", created.status === 201 && Boolean(order?.id), created.json);
  check(
    "server price wins over manipulated client price",
    order.items[0]!.unitPriceTiyin === coffee.priceTiyin,
    order.items[0],
  );

  const duplicate = await device.request<{ duplicate: boolean; order: { id: number } }>("/api/table/orders", {
    method: "POST",
    body: JSON.stringify({ items: [{ productId: coffee.id, quantity: 2, optionIds: [] }], clientRequestId }),
  });
  check(
    "duplicate submission returns the same order",
    duplicate.json.duplicate === true && duplicate.json.order.id === order.id,
  );

  const empty = await device.request("/api/table/orders", {
    method: "POST",
    body: JSON.stringify({ items: [], clientRequestId: `empty-${Date.now()}` }),
  });
  check("empty order rejected", empty.status === 400);

  const visible = await cashier.request<{ orders: Array<{ id: number }> }>("/api/staff/orders?status=active");
  const cashierOrder = visible.json.orders.find((candidate) => candidate.id === order.id);
  check("cashier sees the new order immediately", Boolean(cashierOrder));

  const kitchenLogin = await kitchen.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "oshxona@lolacafe.uz", password: "lola-kitchen-2026" }),
  });
  check("kitchen login", kitchenLogin.status === 200);

  const tickets = await kitchen.request<{
    tickets: Array<{ id: number; orderId: number; items: Array<{ productName: string }> }>;
  }>("/api/staff/kitchen/tickets");
  const orderTickets = tickets.json.tickets.filter((ticket) => ticket.orderId === order.id);
  check(
    "kitchen receives a ticket with the right items",
    orderTickets.length > 0 && orderTickets[0]!.items[0]!.productName === "Kapuchino",
    orderTickets,
  );

  const ticketId = orderTickets[0]!.id;
  const preparing = await kitchen.request(`/api/staff/kitchen/tickets/${ticketId}`, {
    method: "POST",
    body: JSON.stringify({ status: "preparing" }),
  });
  const ready = await kitchen.request(`/api/staff/kitchen/tickets/${ticketId}`, {
    method: "POST",
    body: JSON.stringify({ status: "ready" }),
  });
  check("ticket moves to preparing then ready", preparing.status === 200 && ready.status === 200);

  const customerView = await device.request<{ context: { orders: Array<{ id: number; status: string }> } }>(
    "/api/table/context",
  );
  const customerOrder = customerView.json.context.orders.find((candidate) => candidate.id === order.id);
  check("customer interface reflects the authorized status", customerOrder?.status === "ready", customerOrder);

  const kitchenOrders = await kitchen.request("/api/staff/orders");
  check("kitchen cannot read POS order data", kitchenOrders.status === 403);
  const cashierUsers = await cashier.request("/api/staff/users");
  check("cashier cannot read staff administration", cashierUsers.status === 403);
  const anonOrders = await anon.request("/api/staff/orders");
  check("anonymous cannot read orders", anonOrders.status === 401);

  const paymentId = `verify-pay-${Date.now()}`;
  const paid = await cashier.request<{ order: { paymentStatus: string; dueTiyin: number } }>(
    `/api/staff/orders/${order.id}/payments`,
    { method: "POST", body: JSON.stringify({ method: "cash", clientRequestId: paymentId }) },
  );
  const paidOrder = paid.json.order;
  check("payment recorded and order marked paid", paidOrder.paymentStatus === "paid" && paidOrder.dueTiyin === 0);

  const replay = await cashier.request<{ duplicate: boolean }>(`/api/staff/orders/${order.id}/payments`, {
    method: "POST",
    body: JSON.stringify({ method: "cash", clientRequestId: paymentId }),
  });
  check("replayed payment is idempotent, not duplicated", replay.status === 200 && replay.json.duplicate === true);

  const secondPayment = await cashier.request(`/api/staff/orders/${order.id}/payments`, {
    method: "POST",
    body: JSON.stringify({ method: "cash", clientRequestId: `verify-pay2-${Date.now()}` }),
  });
  check("already-paid order rejects a new payment", secondPayment.status === 409);

  const reports = await cashier.request<{
    summary: { paymentsRecordedTiyin: number; netSalesTiyin: number };
  }>("/api/staff/reports");
  const summary = reports.json.summary;
  check(
    "reports separate recorded payments from order totals",
    summary.paymentsRecordedTiyin > 0 && summary.netSalesTiyin >= summary.paymentsRecordedTiyin,
    summary,
  );

  const sse = await fetch(`${BASE}/api/table/events?after=0`, { headers: { Cookie: device.cookie } });
  const reader = sse.body?.getReader();
  const firstChunk = await reader?.read();
  const streamText = firstChunk?.value ? new TextDecoder().decode(firstChunk.value) : "";
  await reader?.cancel();
  check("customer SSE stream opens scoped to the table", streamText.includes("ready"));

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("verification crashed:", error);
  process.exitCode = 1;
});
