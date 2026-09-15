import test from "node:test";
import assert from "node:assert/strict";
import { api, RequestError, requestErrorMessage } from "../src/lib/api-client";

test('email quota errors retain the server cooldown and do not retry', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return Response.json({ error: 'Email delivery has reached its hourly limit.', retryAfter: 3600 }, { status: 429 });
  });
  await assert.rejects(api('auth/send', { email: 'owner@example.com' }), error =>
    error instanceof RequestError && error.retryAfter === 3600 && /hourly limit/.test(error.message));
  assert.equal(calls, 1);
});

test("a transient read timeout retries once and recovers", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    if (++calls === 1)
      throw new DOMException("signal timed out", "TimeoutError");
    return Response.json({ version: 2 });
  });
  assert.deepEqual(await api("public"), { version: 2 });
  assert.equal(calls, 2);
});

test("gateway HTML recovers on a read and persistent outages have a useful error", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response("<html>Gateway timeout</html>", { status: 504 });
  });
  await assert.rejects(api("public"), /incomplete response/);
  assert.equal(calls, 2);
});

test("timed-out actions are never repeated automatically", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    throw new DOMException("signal timed out", "TimeoutError");
  });
  await assert.rejects(
    api("checkout", { orderId: "example" }),
    /Check its status/,
  );
  assert.equal(calls, 1);
});

test("validation failures are preserved without retries", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({ error: "Sign in required" }, { status: 403 });
  });
  await assert.rejects(api("me"), /Sign in required/);
  assert.equal(calls, 1);
  assert.doesNotMatch(
    requestErrorMessage(new DOMException("signal timed out", "TimeoutError")),
    /signal/i,
  );
});
