import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = 'https://newyorkcity-kappa.vercel.app';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const evidence = { origin, checks: [] };
try {
  const page = await browser.newPage();
  const health = await page.goto(`${origin}/api/health`);
  expect(health.status()).toBe(200);
  // A JSON document keeps the app's own polling out of this idle/reconnect
  // check. Requests use the actual browser network stack, not a TLS fixture.
  const read = () => page.evaluate(async () => {
    const started = performance.now();
    const response = await fetch('/api/public', { cache: 'no-store', signal: AbortSignal.timeout(30000) });
    const data = await response.json();
    return { status: response.status, elapsedMs: Math.round(performance.now() - started), slots: data.slots?.length, mode: data.mode };
  });
  evidence.checks.push(...await Promise.all([read(), read(), read()]));
  await page.waitForTimeout(12000);
  evidence.checks.push(await read());
  for (const check of evidence.checks) {
    expect(check.status).toBe(200);
    expect(check.slots).toBe(72);
    expect(check.elapsedMs).toBeLessThan(10000);
  }
} catch (error) {
  evidence.failure = error.message;
  process.exitCode = 1;
} finally {
  await mkdir('artifacts/audit', { recursive: true });
  await writeFile('artifacts/audit/live-connection-recovery.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
  await browser.close();
}
