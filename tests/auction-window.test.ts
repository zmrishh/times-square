import test, { after } from 'node:test';
import assert from 'node:assert/strict';
process.env.PAPER_DATA_DIR = ':memory:';
process.env.PAYMENT_MODE = 'simulation';
import { query, id, tx, database, closeDatabase, type Row } from '../src/server/db';
import { auctionWindow } from '../src/server/auction-window';
import { reserve, adjustPayment } from '../src/server/auction';
import { startCheckout, simulatePayment } from '../src/server/payments';
import { submitCreative, publicSnapshot, setInventory } from '../src/server/content';
import { placementQuote } from '../src/server/media-pricing';
import { auctionRemaining, countdownParts } from '../src/lib/auction-window';
import { EMPTY_CREATIVE } from '../src/lib/registry';
import type { Account } from '../src/server/auth';

after(closeDatabase);
async function advertiser() {
  const account: Account = { id: id(), email: `${id()}@auction.example`, role: 'advertiser', suspended: false };
  await query('INSERT INTO accounts(id,email) VALUES($1,$2)', [account.id, account.email]);
  const data = { ...EMPTY_CREATIVE, mode: 'template' as const, name: 'Auction fixture', headline: 'A permanent place', url: 'https://auction.example' };
  const creative = await submitCreative(account, data);
  return { account, ...creative, data };
}
async function pay(a: Awaited<ReturnType<typeof advertiser>>, slot: string) {
  const order = await startCheckout((await reserve(a.account, a.creativeId, slot)).id);
  await simulatePayment(order.id, a.account.id);
  return order;
}
async function deadline(interval: string) {
  await query("UPDATE settings SET value=(value-'winners') || jsonb_build_object('endsAt',clock_timestamp()+$1::interval) WHERE id='auction'", [interval]);
}

test('one persisted seven-day window and server-relative countdown boundaries', async () => {
  const first = await tx(auctionWindow);
  const second = await tx(auctionWindow);
  assert.equal(Date.parse(first.endsAt) - Date.parse(first.startsAt), 7 * 86400000);
  assert.equal(first.startsAt, second.startsAt);
  assert.equal(first.endsAt, second.endsAt);
  assert.deepEqual(countdownParts(7 * 86400000), [7, 0, 0, 0]);
  assert.deepEqual(countdownParts(1001), [0, 0, 0, 2]);
  assert.deepEqual(countdownParts(-1), [0, 0, 0, 0]);
  const clock = { ...first, serverNow: new Date(Date.parse(first.endsAt) - 1000).toISOString() };
  assert.equal(auctionRemaining(clock, 999), 1);
  assert.equal(auctionRemaining(clock, 1000), 0);
  assert.equal(auctionRemaining(clock, 2000), 0);
  assert.equal(auctionRemaining({ ...clock, closed: true }), 0);
});

test('highest paid bidder locks; late and duplicate payments cannot change winners; no runner-up promotion', async () => {
  const a = await advertiser(), b = await advertiser(), c = await advertiser();
  const first = await pay(a, 'tsq-001');
  const winning = await pay(b, 'tsq-001');
  await deadline('30 seconds');
  const late = await startCheckout((await reserve(c.account, c.creativeId, 'tsq-001')).id);
  const auction = await tx(auctionWindow);
  assert.equal(new Date(late.cutoff_at).getTime(), Date.parse(auction.endsAt));
  assert.equal(new Date(late.expires_at).getTime(), Date.parse(auction.endsAt));
  await deadline('-1 second');
  // Public closing and payment reconciliation race under the global lock.
  await Promise.all([publicSnapshot(), simulatePayment(late.id, c.account.id)]);
  let snapshot = await publicSnapshot();
  assert.equal(snapshot.auction?.closed, true);
  assert.equal(snapshot.slots.find(s => s.id === 'tsq-001')?.brandId, b.brandId);
  assert.equal((await query('SELECT * FROM allocations WHERE payment_id=$1', [`sim_pay_${late.id}`])).length, 0);
  assert.equal((await query('SELECT * FROM refunds WHERE payment_id=$1', [`sim_pay_${late.id}`])).length, 1);
  await simulatePayment(winning.id, b.account.id);
  await simulatePayment(late.id, c.account.id);
  assert.equal((await query('SELECT * FROM refunds WHERE payment_id=$1', [`sim_pay_${late.id}`])).length, 1);
  for (const slot of ['tsq-001', 'tsq-002']) {
    await assert.rejects(() => reserve(c.account, c.creativeId, slot), /Bidding has ended/);
    await assert.rejects(() => tx(db => placementQuote(db, c.creativeId, c.account.id, slot)), /Bidding has ended/);
  }
  const edited = await submitCreative(b.account, { ...b.data, headline: 'Updated winner artwork' }, b.brandId);
  snapshot = await publicSnapshot();
  assert.equal(snapshot.slots.find(s => s.id === 'tsq-001')?.creativeId, edited.creativeId);
  await adjustPayment(`sim_pay_${winning.id}`, winning.due, winning.due, false);
  await tx(db => setInventory(db, 'tsq-001', true, 5000));
  snapshot = await publicSnapshot();
  assert.equal(snapshot.slots.find(s => s.id === 'tsq-001')?.brandId, null);
  assert.equal((await tx(auctionWindow)).winners?.['tsq-001'], b.brandId);
  assert.equal((await tx(auctionWindow)).winners?.['tsq-002'], null);
  assert.equal((await query<{ amount: number }>('SELECT amount FROM totals WHERE slot_id=$1 AND brand_id=$2', ['tsq-001', a.brandId]))[0].amount, first.due);
});

test('a pre-cutoff admitted payment finishes atomically before closing captures its leader', async () => {
  await deadline('7 days');
  const a = await advertiser(), b = await advertiser();
  await pay(a, 'tsq-003');
  const next = await startCheckout((await reserve(b.account, b.creativeId, 'tsq-003')).id);
  const store = await database();
  const transaction = store.transaction;
  // Move the deadline past only after real payment validation, before its
  // allocation is saved: model a transaction crossing the closing instant.
  store.transaction = fn => transaction(db => fn({
    query: async <T extends Row>(sql: string, params?: unknown[]) => {
      if (sql.startsWith('INSERT INTO allocations')) {
        await db.query("UPDATE settings SET value=jsonb_set(value,'{endsAt}',to_jsonb(clock_timestamp()-interval '1 second')) WHERE id='auction'");
      }
      return db.query<T>(sql, params);
    },
  }));
  try { await simulatePayment(next.id, b.account.id); }
  finally { store.transaction = transaction; }
  const closed = await tx(auctionWindow);
  assert.equal(closed.winners?.['tsq-003'], b.brandId);
  assert.equal((await query('SELECT state FROM orders WHERE id=$1', [next.id]))[0].state, 'delivered');
  assert.equal(closed.closed, true);
});

test('reserved checkout cannot start after deadline, including an unclaimed slot', async () => {
  await deadline('7 days');
  const a = await advertiser();
  const order = await reserve(a.account, a.creativeId, 'tsq-004');
  await deadline('-1 second');
  await assert.rejects(() => startCheckout(order.id), /Bidding has ended/);
  const snapshot = await publicSnapshot();
  assert.equal(snapshot.slots.find(s => s.id === 'tsq-004')?.brandId, null);
});
