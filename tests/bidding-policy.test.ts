import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { query, id, tx, closeDatabase } from '../src/server/db';
import { reserve, adjustPayment } from '../src/server/auction';
import { startCheckout, simulatePayment } from '../src/server/payments';
import { submitCreative, publicSnapshot } from '../src/server/content';
import { placementQuote } from '../src/server/media-pricing';
import { EMPTY_CREATIVE } from '../src/lib/registry';
import type { Account } from '../src/server/auth';

process.env.PAPER_DATA_DIR = ':memory:';
process.env.PAYMENT_MODE = 'simulation';
after(closeDatabase);

async function advertiser(name: string) {
  const account: Account = { id: id(), email: `${id()}@bidding.example`, role: 'advertiser', suspended: false };
  await query('INSERT INTO accounts(id,email) VALUES($1,$2)', [account.id, account.email]);
  const creative = await submitCreative(account, { ...EMPTY_CREATIVE, name, url: 'https://bidding.example',
    mode: 'template', headline: name });
  return { account, ...creative };
}
async function slot(slotId: string) {
  return (await publicSnapshot()).slots.find(s => s.id === slotId)!;
}

test('occupied TSQ-007 enforces $10 more, serializes competing bidders, and credits a returning advertiser', async () => {
  const a = await advertiser('First advertiser'), b = await advertiser('Second advertiser'), c = await advertiser('Third advertiser');
  const first = await startCheckout((await reserve(a.account, a.creativeId, 'tsq-007', 10000, 10000)).id);
  assert.equal((await slot('tsq-007')).brandId, null, 'Checkout alone must not place artwork');
  await simulatePayment(first.id, a.account.id);
  assert.equal((await slot('tsq-007')).total, 10000);
  await assert.rejects(reserve(b.account, b.creativeId, 'tsq-007', 10999, 10999), /Target/);
  assert.equal((await slot('tsq-007')).brandId, a.brandId);
  const result = await Promise.allSettled([
    reserve(b.account, b.creativeId, 'tsq-007', 11000, 11000),
    reserve(c.account, c.creativeId, 'tsq-007', 11000, 11000),
  ]);
  const accepted = result.filter(r => r.status === 'fulfilled');
  assert.equal(accepted.length, 1, 'Only one bidder can reserve the occupied placement');
  const order = accepted[0].value;
  const winner = order.account_id === b.account.id ? b : c;
  const retry = await reserve(winner.account, winner.creativeId, 'tsq-007', 11000, 11000);
  assert.equal(retry.id, order.id, 'Retry reuses the existing order');
  assert.equal((await slot('tsq-007')).brandId, a.brandId, 'Paid incumbent remains during rival checkout');
  await startCheckout(order.id);
  await simulatePayment(order.id, winner.account.id);
  assert.equal((await slot('tsq-007')).brandId, winner.brandId);
  assert.equal((await slot('tsq-007')).total, 11000);
  const returning = await tx(db => placementQuote(db, a.creativeId, a.account.id, 'tsq-007'));
  assert.equal(returning.target, 12000);
  assert.equal(returning.existing, 10000);
  assert.equal(returning.due, 2000, 'Returning advertiser only pays the remaining $20');
  await assert.rejects(reserve(a.account, a.creativeId, 'tsq-007', 11999, 1999), /Target/);
  const comeback = await startCheckout((await reserve(a.account, a.creativeId, 'tsq-007', 12000, 2000)).id);
  await simulatePayment(comeback.id, a.account.id);
  await simulatePayment(comeback.id, a.account.id);
  assert.equal((await slot('tsq-007')).total, 12000, 'Duplicate settlement must not double the rank');
  assert.equal((await slot('tsq-007')).brandId, a.brandId);
  assert.equal((await query("SELECT * FROM history WHERE slot_id='tsq-007' AND ended_at IS NULL")).length, 1);
  await assert.rejects(reserve(a.account, a.creativeId, 'tsq-007'), /already lead/);
  const elsewhere = await tx(db => placementQuote(db, a.creativeId, a.account.id, 'tsq-008'));
  assert.equal(elsewhere.existing, 0, 'Credit cannot move to another billboard');
});

test('even a refunded sub-$10 leader requires a $10 increment under the optional double preset', async () => {
  const a = await advertiser('Low ranking'), b = await advertiser('Next bidder');
  await query("UPDATE slots SET opening=100 WHERE id='tsq-009'");
  const first = await startCheckout((await reserve(a.account, a.creativeId, 'tsq-009', 100, 100)).id);
  await simulatePayment(first.id, a.account.id);
  await adjustPayment(`sim_pay_${first.id}`, 99, 99, false);
  assert.equal((await slot('tsq-009')).total, 1);
  await query("UPDATE settings SET value=jsonb_set(value,'{preset}','\"double\"') WHERE id='global'");
  try {
    await assert.rejects(reserve(b.account, b.creativeId, 'tsq-009', 2, 2), /Target/);
    const quote = await tx(db => placementQuote(db, b.creativeId, b.account.id, 'tsq-009'));
    assert.equal(quote.minimum, 1001);
    const next = await startCheckout((await reserve(b.account, b.creativeId, 'tsq-009', 1001, 1001)).id);
    await simulatePayment(next.id, b.account.id);
    assert.equal((await slot('tsq-009')).total, 1001);
  } finally {
    await query("UPDATE settings SET value=jsonb_set(value,'{preset}','\"quarter\"') WHERE id='global'");
  }
});
