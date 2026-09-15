import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { requestEmailLink, exchangeEmailLink, type AuthCookies } from '../src/server/email-link';
import { authReturnPath } from '../src/lib/auth-return';
import { authSettings, siteUrl } from '../scripts/configure-supabase-auth.mjs';
import { RateLimitError } from '../src/server/errors';
import { requestGoogleSignIn, exchangeGoogleSignIn } from '../src/server/google-auth';

test('Google binds the exchange to the initiating browser and accepts only verified Google identities', async () => {
  process.env.SUPABASE_URL = 'https://auth-fixture.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-key';
  process.env.APP_ORIGIN = siteUrl;
  const values = new Map<string, string>();
  const store: AuthCookies = {
    get: key => values.has(key) ? { value: values.get(key)! } : undefined,
    set: (key, value, options) => { assert.equal(options.httpOnly, true); values.set(key, value); },
    delete: key => values.delete(key),
  };
  const nativeFetch = globalThis.fetch;
  let challenge = '', verified = true, google = true;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    assert.equal(new URL(request.url).pathname, '/auth/v1/token');
    const body = await request.json();
    assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'), challenge);
    return Response.json({ access_token: 'fixture-access', refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600,
      user: { id: 'fixture', email: 'Owner@example.com', email_confirmed_at: verified ? new Date().toISOString() : null,
        identities: [{ provider: google ? 'google' : 'email' }] } });
  };
  const begin = async (target: string) => {
    const url = new URL((await requestGoogleSignIn(target, store)).url);
    assert.equal(url.origin, 'https://auth-fixture.supabase.co');
    assert.equal(url.pathname, '/auth/v1/authorize');
    assert.equal(url.searchParams.get('provider'), 'google');
    assert.equal(url.searchParams.get('redirect_to'), `${siteUrl}/auth/callback`);
    assert.equal(url.searchParams.get('code_challenge_method'), 's256');
    assert.equal(url.searchParams.get('apikey'), null);
    challenge = url.searchParams.get('code_challenge')!;
  };
  try {
    await assert.rejects(exchangeGoogleSignIn('stolen-code', store), /this browser/);
    const target = '/?billboard=tsq-013&panel=editor';
    await begin(target);
    await assert.rejects(exchangeGoogleSignIn('', store), /this browser/);
    assert.deepEqual(await exchangeGoogleSignIn('valid-code', store), { email: 'owner@example.com', returnTo: target });
    assert.equal(values.has('paper_google_verifier'), false);
    assert.ok([...values.values()].every(value => !value.includes('fixture-access') && !value.includes('fixture-refresh')));
    await assert.rejects(exchangeGoogleSignIn('valid-code', store), /this browser/);
    await begin('https://evil.example');
    assert.equal(values.get('paper_google_return'), '/?panel=account');
    verified = false;
    await assert.rejects(exchangeGoogleSignIn('unverified', store), /could not be verified/);
    verified = true; google = false;
    await begin(target);
    await assert.rejects(exchangeGoogleSignIn('wrong-provider', store), /could not be verified/);
  } finally { globalThis.fetch = nativeFetch; }
});

test('email link binds its code exchange to this browser and restores the requested editor', async () => {
  process.env.SUPABASE_URL = 'https://auth-fixture.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-key';
  process.env.APP_ORIGIN = siteUrl;
  const values = new Map<string, string>();
  const store: AuthCookies = {
    get: key => values.has(key) ? { value: values.get(key)! } : undefined,
    set: (key, value, options) => { assert.equal(options.httpOnly, true); assert.equal(options.sameSite, 'lax'); values.set(key, value); },
    delete: key => values.delete(key),
  };
  const nativeFetch = globalThis.fetch;
  let challenge = '', wrongEmail = false, failed = false, sends = 0;
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init), url = new URL(req.url);
    assert.equal(url.hostname, 'auth-fixture.supabase.co');
    const body = await req.json();
    if (url.pathname === '/auth/v1/otp') {
      assert.equal(url.searchParams.get('redirect_to'), `${siteUrl}/auth/callback`);
      assert.equal(body.email, 'owner@example.com');
      assert.equal(body.code_challenge_method, 's256');
      sends++;
      if (failed) return Response.json({ code: 'over_email_send_rate_limit', msg: 'Email rate limit exceeded' },
        { status: 429, headers: { 'X-Supabase-Api-Version': '2024-01-01' } });
      challenge = body.code_challenge;
      return Response.json({});
    }
    assert.equal(url.pathname, '/auth/v1/token');
    assert.equal(url.searchParams.get('grant_type'), 'pkce');
    assert.equal(body.auth_code, 'provider-code');
    assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'), challenge);
    return Response.json({ access_token: 'fixture-access', refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600,
      user: { id: 'fixture', email: wrongEmail ? 'stranger@example.com' : 'owner@example.com', email_confirmed_at: new Date().toISOString() } });
  };
  try {
    const target = '/?billboard=tsq-013&panel=editor';
    assert.deepEqual(await requestEmailLink('owner@example.com', target, store), { sent: true, method: 'link', retryAfter: 60 });
    const verifier = values.get('paper_auth_verifier');
    const duplicate = await requestEmailLink('owner@example.com', target, store, async () => { assert.fail('Duplicates must not consume the app rate limit'); });
    assert.ok(duplicate.retryAfter > 0);
    assert.equal(sends, 1);
    assert.equal(values.get('paper_auth_verifier'), verifier);
    values.set('paper_auth_sent_at', String(Date.now() - 61000));
    failed = true;
    await assert.rejects(requestEmailLink('owner@example.com', target, store), error => error instanceof RateLimitError && error.retryAfter === 60 && /hourly limit/.test(error.message));
    assert.equal(values.get('paper_auth_verifier'), verifier, 'Rejected resend must preserve the already emailed link');
    failed = false;
    assert.deepEqual(await exchangeEmailLink('provider-code', store), { email: 'owner@example.com', returnTo: target });
    assert.equal(values.has('paper_auth_verifier'), false);
    assert.ok([...values.values()].every(v => !v.includes('fixture-access') && !v.includes('fixture-refresh')));
    await assert.rejects(exchangeEmailLink('provider-code', store), /same browser/);
    await requestEmailLink('owner@example.com', target, store);
    wrongEmail = true;
    await assert.rejects(exchangeEmailLink('provider-code', store), /invalid or expired/);
    failed = true;
    await assert.rejects(requestEmailLink('owner@example.com', target, store), /hourly limit/);
  } finally { globalThis.fetch = nativeFetch; }
});

test('return destinations cannot redirect externally or inject unsupported app routes', () => {
  for (const input of ['https://evil.example', '//evil.example', '/\\evil.example', '/?next=https://evil.example', '/auth/callback?code=secret', '/?billboard=unknown'])
    assert.equal(authReturnPath(input), '/?panel=account');
  assert.equal(authReturnPath('/?billboard=tsq-044&panel=admin'), '/?billboard=tsq-044');
  const settings = authSettings({ uri_allow_list: 'http://localhost:3001' });
  assert.equal(settings.site_url, siteUrl);
  assert.ok(settings.uri_allow_list.includes(`${siteUrl}/auth/callback`));
  assert.equal(Object.keys(settings).length, 2);
});
