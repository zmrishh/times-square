import test, { after, mock } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHmac } from "node:crypto";
import DodoPayments from "dodopayments";
import { CheckoutSessions } from "dodopayments/resources/checkout-sessions";
import { boundedBody } from "../src/server/request-body";
import { quoteAmount, nextMinimum } from "../src/lib/rules";
import { origin, validateProduction } from "../src/server/config";
import { EMPTY_CREATIVE } from "../src/lib/registry";
process.env.PAPER_DATA_DIR = ":memory:";
process.env.PAYMENT_MODE = "simulation";
import { query, id, closeDatabase, database } from "../src/server/db";
import {
  reserve,
  applyEvidence,
  adjustPayment,
  PaymentEvidence,
  Order,
  evidenceMatches,
} from "../src/server/auction";
import {
  submitCreative,
  moderate,
  publicSnapshot,
} from "../src/server/content";
import { startCheckout, processRefund } from "../src/server/payments";
import type { Account } from "../src/server/auth";
after(async () => closeDatabase());

test("chunked requests are bounded before buffering", async () => {
  const request = new Request("http://localhost", {
    method: "POST",
    body: new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array(12));
        c.enqueue(new Uint8Array(12));
        c.close();
      },
    }),
    duplex: "half",
  } as RequestInit);
  await assert.rejects(() => boundedBody(request, 20), /too large/);
  assert.equal(
    new TextDecoder().decode(
      await boundedBody(
        new Request("http://localhost", { method: "POST", body: "hello" }),
        20,
      ),
    ),
    "hello",
  );
});
test("integer ranking policy and slot-local returning contribution", () => {
  assert.equal(nextMinimum(10000, 1000), 12500);
  assert.equal(nextMinimum(1100, 1000), 1600);
  assert.equal(nextMinimum(2100, 1000), 2700);
  assert.equal(nextMinimum(10000, 1000, "double"), 20000);
  assert.deepEqual(quoteAmount(10000, 4000, 1000, 12500).due, 8500);
  assert.equal(quoteAmount(10000, 0, 1000).due, 12500);
  for (const invalid of [NaN, Infinity, -1, 12500.1, 100, 1000001])
    assert.throws(() => quoteAmount(10000, 0, 1000, invalid));
});
test("production redirects reject loopback, insecure and request-like origins", () => {
  for (const bad of [
    "http://paper.example",
    "https://localhost",
    "https://127.0.0.1",
    "https://127.1",
    "https://[::1]",
    "https://10.0.0.1",
    "https://user:pass@example.com",
    "https://example.com/path",
  ])
    assert.throws(() => origin(bad, true));
  assert.equal(origin("https://paper.example", true), "https://paper.example");
});
test("official SDK rejects invalid signatures and accepts a signed payload", () => {
  const secret = Buffer.from("paper-square-test-webhook-secret").toString(
    "base64",
  );
  const sdk = new DodoPayments({
    bearerToken: "test-only",
    webhookKey: `whsec_${secret}`,
    environment: "test_mode",
  });
  const raw = JSON.stringify({
    type: "payment.succeeded",
    data: { payment_id: "test" },
    business_id: "b",
    timestamp: new Date().toISOString(),
  });
  const event = "test-event",
    timestamp = String(Math.floor(Date.now() / 1000));
  assert.throws(() =>
    sdk.webhooks.unwrap(raw, {
      headers: {
        "webhook-id": event,
        "webhook-timestamp": timestamp,
        "webhook-signature": "v1,invalid",
      },
    }),
  );
  const signature = createHmac("sha256", Buffer.from(secret, "base64"))
    .update(`${event}.${timestamp}.${raw}`)
    .digest("base64");
  assert.ok(
    sdk.webhooks.unwrap(raw, {
      headers: {
        "webhook-id": event,
        "webhook-timestamp": timestamp,
        "webhook-signature": `v1,${signature}`,
      },
    }),
  );
});

test("production URL errors name the setting without leaking its value", () => {
  const fixture = {
    NODE_ENV: "production", APP_ORIGIN: "https://paper.example",
    AUTH_MODE: "supabase", PAYMENT_MODE: "dodo-test",
    DATABASE_URL: "postgresql://user:private-password@db.example:6543/postgres",
    SUPABASE_URL: "https://project.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "fixture-key",
    DODO_PAYMENTS_API_KEY: "fixture-key", DODO_PAYMENTS_WEBHOOK_KEY: "fixture-key",
    DODO_PRODUCT_ID: "fixture-product", DODO_BUSINESS_ID: "fixture-business",
    JOB_SECRET: "fixture-worker-secret-at-least-32-characters", SUPPORT_EMAIL: "support@example.com",
  };
  const before = Object.fromEntries(Object.keys(fixture).map(key => [key, process.env[key]]));
  Object.assign(process.env, fixture);
  try {
    assert.doesNotThrow(validateProduction);
    for (const key of ["APP_ORIGIN", "SUPABASE_URL", "DATABASE_URL"]) {
      Object.assign(process.env, fixture, { [key]: "secret-value-that-is-not-a-url" });
      assert.throws(validateProduction, (error: unknown) =>
        error instanceof Error && error.message.includes(key) && !error.message.includes("secret-value"));
    }
    Object.assign(process.env, fixture, { DATABASE_URL: "https://db.example" });
    assert.throws(validateProduction, /Invalid DATABASE_URL/);
    for (const url of ["http://project.supabase.co", "https://project.supabase.co/rest/v1", "https://user:password@project.supabase.co"]) {
      Object.assign(process.env, fixture, { SUPABASE_URL: url });
      assert.throws(validateProduction, /Invalid SUPABASE_URL/);
    }
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
test("database integration: reservations, evidence, refunds and access boundaries", async (t) => {
  const users: Account[] = [];
  for (let i = 0; i < 6; i++) {
    const a: Account = {
      id: id(),
      email: `test${i}@example.com`,
      role: i === 0 ? "admin" : "advertiser",
      suspended: false,
    };
    await query("INSERT INTO accounts(id,email,role) VALUES($1,$2,$3)", [
      a.id,
      a.email,
      a.role,
    ]);
    users.push(a);
  }
  const creatives: Awaited<ReturnType<typeof submitCreative>>[] = [];
  for (let i = 1; i < 6; i++) {
    const c = await submitCreative(users[i], {
      ...EMPTY_CREATIVE,
      name: `Brand ${i}`,
      url: `https://brand${i}.example`,
    });
    assert.equal(c.status, "approved");
    creatives.push(c);
  }
  const quote = async (i: number, slot: string, target?: number) => {
    await query("DELETE FROM rate_limits");
    const o = await reserve(
      users[i + 1],
      creatives[i].creativeId,
      slot,
      target,
    );
    return startCheckout(o.id);
  };
  const evidence = (
    o: Order,
    extra: Partial<PaymentEvidence> = {},
  ): PaymentEvidence => ({
    id: `sim_pay_${o.id}`,
    orderId: o.id,
    sessionId: o.session_id,
    mode: "simulation",
    businessId: "local",
    productId: o.product_id,
    quantity: 1,
    email: o.customer_email,
    customerId: `customer_${o.account_id}`,
    principal: o.due,
    tax: 0,
    cash: o.due,
    currency: "USD",
    status: "succeeded",
    refundedPrincipal: 0,
    refundedCash: 0,
    disputed: false,
    raw: { test: true },
    ...extra,
  });
  await t.test(
    "direct checkout preserves validation, ownership and unpublished artwork",
    async () => {
      await assert.rejects(
        () =>
          submitCreative(
            users[2],
            { ...EMPTY_CREATIVE, name: "Other", url: "https://other.example" },
            creatives[0].brandId,
          ),
        /do not own/,
      );
      await assert.rejects(
        () =>
          submitCreative(users[1], {
            ...EMPTY_CREATIVE,
            name: "Invalid",
            url: "javascript:alert(1)",
          }),
        /HTTPS/,
      );
      const pending = await submitCreative(users[1], {
        ...EMPTY_CREATIVE,
        name: "Pending",
        url: "https://pending.example",
      });
      assert.equal(pending.status, "approved");
      const direct = await reserve(users[1], pending.creativeId, "tsq-015");
      assert.equal(direct.creative_id, pending.creativeId);
      assert.equal(
        (await publicSnapshot()).slots.find((s) => s.id === "tsq-015")?.brandId,
        null,
      );
      assert.ok(
        !(await publicSnapshot()).directory.some(
          (b) => b.id === pending.brandId,
        ),
      );
      await query(
        "UPDATE orders SET state='expired',reserved=false WHERE id=$1",
        [direct.id],
      );
      // Legacy pending and rejected versions are never silently repurposed.
      await query("UPDATE creatives SET status='pending' WHERE id=$1", [
        pending.creativeId,
      ]);
      await assert.rejects(
        () => reserve(users[1], pending.creativeId, "tsq-015"),
        /unavailable/,
      );
      await moderate(
        users[0],
        pending.creativeId,
        false,
        "Legacy test rejection",
      );
      await assert.rejects(
        () => reserve(users[1], pending.creativeId, "tsq-015"),
        /unavailable/,
      );
      await assert.rejects(
        () => reserve(users[2], creatives[0].creativeId, "tsq-015"),
        /do not own/,
      );
    },
  );
  let first: Order, second: Order, third: Order;
  await t.test(
    "new and returning advertisers pay exact difference; same payment applies once",
    async () => {
      first = await quote(0, "tsq-013", 4000);
      await applyEvidence(evidence(first));
      second = await quote(1, "tsq-013", 10000);
      await applyEvidence(evidence(second));
      third = await quote(0, "tsq-013", 12500);
      assert.equal(third.due, 8500);
      await applyEvidence(evidence(third));
      await applyEvidence(evidence(third));
      const totals = await query<{ amount: number }>(
        "SELECT amount FROM totals WHERE slot_id=$1 AND brand_id=$2",
        ["tsq-013", creatives[0].brandId],
      );
      assert.equal(totals[0].amount, 12500);
      assert.equal(
        (
          await query("SELECT * FROM payments WHERE id=$1", [
            evidence(third).id,
          ])
        ).length,
        1,
      );
      await assert.rejects(() => quote(0, "tsq-013"), /already lead/);
    },
  );
  await t.test("spending on another slot is not credited", async () => {
    const other = await quote(0, "tsq-015");
    assert.equal(other.existing, 0);
    assert.equal(other.due, 1000);
    await applyEvidence(evidence(other));
  });
  await t.test(
    "concurrent reservations yield one winner and retry reuses its intent",
    async () => {
      await query("DELETE FROM rate_limits");
      const result = await Promise.allSettled([
        reserve(users[3], creatives[2].creativeId, "tsq-014"),
        reserve(users[4], creatives[3].creativeId, "tsq-014"),
      ]);
      assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
      const winner = result.find(
        (r) => r.status === "fulfilled",
      ) as PromiseFulfilledResult<Order>;
      const user = users.find((a) => a.id === winner.value.account_id)!;
      const again = await reserve(user, winner.value.creative_id, "tsq-014");
      assert.equal(again.id, winner.value.id);
      assert.equal(
        (
          await query(
            "SELECT id FROM orders WHERE slot_id='tsq-014' AND reserved=true",
          )
        ).length,
        1,
      );
    },
  );
  await t.test(
    "mismatched amount / currency / customer / environment cannot deliver",
    async () => {
      const o = await quote(2, "tsq-012");
      for (const extra of [
        { cash: 999 },
        { principal: 999 },
        { currency: "EUR" },
        { email: "wrong@example.com" },
        { mode: "dodo-live" },
        { businessId: "other" },
        { quantity: 2 },
        { productId: "other" },
      ])
        assert.equal(evidenceMatches(o, evidence(o, extra)), false);
      await applyEvidence(
        evidence(o, { cash: o.due + 100, principal: o.due + 100 }),
      );
      assert.equal(
        (
          await query<{ state: string }>(
            "SELECT state FROM payments WHERE order_id=$1",
            [o.id],
          )
        )[0].state,
        "undelivered",
      );
      assert.equal(
        (
          await query<{ leader_brand: string | null }>(
            "SELECT leader_brand FROM slots WHERE id=$1",
            [o.slot_id],
          )
        )[0].leader_brand,
        null,
      );
    },
  );
  await t.test(
    "full refund and chargeback recompute leader; duplicate adjustments do not change version",
    async () => {
      await adjustPayment(evidence(third).id, third.due, third.due, false);
      assert.equal(
        (
          await query<{ leader_brand: string }>(
            "SELECT leader_brand FROM slots WHERE id=$1",
            ["tsq-013"],
          )
        )[0].leader_brand,
        creatives[1].brandId,
      );
      await adjustPayment(evidence(second).id, 0, 0, true);
      assert.equal(
        (
          await query<{ leader_brand: string }>(
            "SELECT leader_brand FROM slots WHERE id=$1",
            ["tsq-013"],
          )
        )[0].leader_brand,
        creatives[0].brandId,
      );
      await adjustPayment(evidence(second).id, 0, 0, false);
      const before = (
        await query<{ version: number }>(
          "SELECT version FROM slots WHERE id=$1",
          ["tsq-013"],
        )
      )[0].version;
      await adjustPayment(evidence(second).id, 0, 0, false);
      assert.equal(
        (
          await query<{ version: number }>(
            "SELECT version FROM slots WHERE id=$1",
            ["tsq-013"],
          )
        )[0].version,
        before,
      );
    },
  );
  await t.test(
    "late settled checkout is undelivered and durably refunded",
    async () => {
      const o = await quote(3, "tsq-011");
      const clock = mock.method(
        Date,
        "now",
        () => new Date(o.cutoff_at).getTime() + 1000,
      );
      try {
        await applyEvidence(evidence(o));
      } finally {
        clock.mock.restore();
      }
      const refund = (
        await query<{ id: string; state: string }>(
          "SELECT id,state FROM refunds WHERE payment_id=$1",
          [evidence(o).id],
        )
      )[0];
      assert.equal(refund.state, "queued");
      await processRefund(refund.id);
      assert.equal(
        (
          await query<{ state: string }>(
            "SELECT state FROM refunds WHERE id=$1",
            [refund.id],
          )
        )[0].state,
        "succeeded",
      );
      assert.equal(
        (
          await query<{ state: string }>(
            "SELECT state FROM orders WHERE id=$1",
            [o.id],
          )
        )[0].state,
        "refunded",
      );
    },
  );
  await t.test(
    "public payload omits emails, payment identifiers and drafts",
    async () => {
      const publicData = JSON.stringify(await publicSnapshot());
      for (const a of users) assert.ok(!publicData.includes(a.email));
      assert.ok(!publicData.includes("customer_email"));
      assert.ok(!publicData.includes("sim_pay_"));
      assert.ok(!publicData.includes("checkout_url"));
      assert.ok(!publicData.includes("Pending"));
    },
  );
  await t.test(
    "saved edits only replace a still-leading advertiser",
    async () => {
      const edit = await submitCreative(
        users[1],
        {
          ...EMPTY_CREATIVE,
          name: "Edited Brand 1",
          url: "https://brand1.example",
        },
        creatives[0].brandId,
      );
      assert.equal(edit.status, "approved");
      const s = (
        await query<{ creative_id: string }>(
          "SELECT creative_id FROM slots WHERE id=$1",
          ["tsq-013"],
        )
      )[0];
      assert.equal(s.creative_id, creatives[1].creativeId);
      assert.ok(!edit.updatedSlots.includes("tsq-013"));
      const leaderEdit = await submitCreative(
        users[2],
        {
          ...EMPTY_CREATIVE,
          name: "Updated leader",
          url: "https://brand2.example",
        },
        creatives[1].brandId,
      );
      assert.ok(leaderEdit.updatedSlots.includes("tsq-013"));
      assert.equal(
        (
          await query<{ creative_id: string }>(
            "SELECT creative_id FROM slots WHERE id='tsq-013'",
          )
        )[0].creative_id,
        leaderEdit.creativeId,
      );
    },
  );
  await t.test(
    "ambiguous provider creation is not repeated on retry",
    async () => {
      process.env.PAYMENT_MODE = "dodo-test";
      process.env.DODO_PRODUCT_ID = "test-product";
      process.env.DODO_BUSINESS_ID = "test-business";
      process.env.DODO_PAYMENTS_API_KEY = "test-only";
      let calls = 0;
      const mocked = mock.method(CheckoutSessions.prototype, "create", () => {
        calls++;
        throw new Error(
          "Network timeout after provider may have accepted intent",
        );
      });
      try {
        await query("DELETE FROM rate_limits");
        const o = await reserve(users[5], creatives[4].creativeId, "tsq-010");
        await assert.rejects(() => startCheckout(o.id), /being reconciled/);
        const again = await startCheckout(o.id);
        assert.equal(again.state, "ambiguous");
        assert.equal(again.reserved, true);
        assert.equal(calls, 1);
      } finally {
        mocked.mock.restore();
        process.env.PAYMENT_MODE = "simulation";
      }
    },
  );
  await t.test(
    "out-of-order failure cannot regress a committed success",
    async () => {
      await applyEvidence(evidence(second, { status: "failed" }));
      const p = (
        await query<{ state: string }>(
          "SELECT state FROM payments WHERE id=$1",
          [evidence(second).id],
        )
      )[0];
      assert.notEqual(p.state, "failed");
    },
  );
  await t.test(
    "audit, quote and creative data are immutable at the database boundary",
    async () => {
      await assert.rejects(
        () =>
          query(
            "UPDATE audit SET action='invented' WHERE id=(SELECT id FROM audit LIMIT 1)",
          ),
        /immutable/,
      );
      await assert.rejects(
        () =>
          query("UPDATE creatives SET data='{}' WHERE id=$1", [
            creatives[0].creativeId,
          ]),
        /immutable/,
      );
      await assert.rejects(
        () => query("UPDATE orders SET due=due+1 WHERE id=$1", [first.id]),
        /immutable/,
      );
    },
  );
  await t.test(
    "partial refund tax attribution restores only verified principal and survives reconciliation",
    async () => {
      const o = await quote(4, "tsq-009", 5000);
      const e = evidence(o, { tax: 500, cash: 5500 });
      await applyEvidence(e);
      await adjustPayment(e.id, 1100, 1100, false);
      assert.equal(
        (
          await query<{ amount: number }>(
            "SELECT amount FROM allocations WHERE payment_id=$1",
            [e.id],
          )
        )[0].amount,
        3900,
      );
      await query(
        "INSERT INTO refund_attributions(payment_id,refunded_cash,refunded_principal,evidence_reference,actor) VALUES($1,1100,1000,$2,$3)",
        [
          e.id,
          "Confirmed test refund receipt: $10 principal, $1 tax",
          users[0].id,
        ],
      );
      await adjustPayment(e.id, 1100, 1100, false);
      assert.equal(
        (
          await query<{ amount: number }>(
            "SELECT amount FROM allocations WHERE payment_id=$1",
            [e.id],
          )
        )[0].amount,
        4000,
      );
      await adjustPayment(e.id, 0, 0, true);
      await adjustPayment(e.id, 0, 0, false);
      assert.equal(
        (
          await query<{ state: string }>(
            "SELECT state FROM payments WHERE id=$1",
            [e.id],
          )
        )[0].state,
        "applied",
      );
      await adjustPayment(e.id, 5000, 5500, false);
      assert.equal(
        (
          await query<{ amount: number }>(
            "SELECT amount FROM allocations WHERE payment_id=$1",
            [e.id],
          )
        )[0].amount,
        0,
      );
    },
  );
  await t.test(
    "RLS denies public readers even if table SELECT is granted",
    async () => {
      await query("CREATE ROLE paper_public NOLOGIN");
      await query("GRANT USAGE ON SCHEMA public TO paper_public");
      await query(
        "GRANT SELECT ON accounts,orders,assets,payments TO paper_public",
      );
      await (
        await database()
      ).transaction(async (db) => {
        await db.query("SET LOCAL ROLE paper_public");
        for (const table of ["accounts", "orders", "assets", "payments"]) {
          const count = await db.query<{ count: string }>(
            `SELECT count(*)::text AS count FROM ${table}`,
          );
          assert.equal(count.rows[0].count, "0");
        }
      });
    },
  );
});

test("expanded inventory migration is repeatable and preserves commercial records", async () => {
  const store = await database();
  const sql = await readFile("migrations/006_expanded_inventory.sql", "utf8");
  const tables = [
    "slots",
    "brands",
    "creatives",
    "orders",
    "payments",
    "allocations",
    "totals",
    "history",
  ];
  const capture = async () =>
    Object.fromEntries(
      await Promise.all(
        tables.map(async (table) => [
          table,
          await query(`SELECT * FROM ${table} ORDER BY 1,2`),
        ]),
      ),
    );
  await query(
    "UPDATE slots SET opening=1700,available=false,version=37 WHERE id='tsq-072'",
  );
  const before = await capture();
  await store.db.query(sql);
  await store.db.query(sql);
  assert.deepEqual(await capture(), before);
  assert.equal((await query("SELECT id FROM slots")).length, 72);
  await query(
    "UPDATE slots SET opening=2500,available=true,version=1 WHERE id='tsq-072'",
  );
});
