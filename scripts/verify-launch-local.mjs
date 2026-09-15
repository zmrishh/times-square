import { spawn, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
const origin = 'http://localhost:3004';
const env = { ...process.env, DATABASE_URL: '', AUTH_MODE: 'local', PAYMENT_MODE: 'simulation',
  PAPER_DATA_DIR: ':memory:', APP_ORIGIN: origin, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' };
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '-p', '3004'],
  { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
app.stdout.on('data', b => { logs += b; });
app.stderr.on('data', b => { logs += b; });
try {
  await expect.poll(async () => {
    try { return (await fetch(`${origin}/api/health`)).status; } catch { return 0; }
  }, { timeout: 90000, intervals: [1000] }).toBe(200);
  process.env.PAPER_TEST_ORIGIN = origin;
  process.env.PAPER_CAPTURE_SOCIAL = '1';
  await import('./verify-launch-ui.mjs');
} catch (error) {
  await mkdir('artifacts/launch', { recursive: true });
  await writeFile('artifacts/launch/server.log', logs);
  throw error;
} finally {
  if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(app.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  else app.kill('SIGTERM');
}
