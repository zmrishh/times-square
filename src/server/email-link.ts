import { createClient } from '@supabase/supabase-js';
import { origin, required } from './config';
import { authReturnPath } from '../lib/auth-return';
import { RateLimitError } from './errors';

type CookieOptions = { httpOnly: boolean; sameSite: 'lax'; secure: boolean; path: string; maxAge: number };
export type AuthCookies = {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options: CookieOptions): unknown;
  delete(name: string): unknown;
};
const options = (): CookieOptions => ({ httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 3600 });
const verifierCookie = 'paper_auth_verifier';

export function linkClient(store: AuthCookies, google = false) {
  const storageKey = google ? 'paper-google-auth' : 'paper-auth';
  const cookieName = google ? 'paper_google_verifier' : verifierCookie;
  return createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: {
      flowType: 'pkce', storageKey, persistSession: true,
      autoRefreshToken: false, detectSessionInUrl: false,
      storage: {
        getItem: key => key === `${storageKey}-code-verifier` ? store.get(cookieName)?.value || null : null,
        setItem: (key, value) => { if (key === `${storageKey}-code-verifier`) store.set(cookieName, value, options()); },
        removeItem: key => { if (key === `${storageKey}-code-verifier`) store.delete(cookieName); },
      },
    },
  });
}

export async function requestEmailLink(email: string, returnTo: unknown, store: AuthCookies, beforeSend?: () => Promise<void>) {
  const elapsed = Date.now() - Number(store.get('paper_auth_sent_at')?.value || 0);
  if (store.get('paper_auth_email')?.value === email && store.get(verifierCookie) && elapsed >= 0 && elapsed < 60000) {
    store.set('paper_auth_return', authReturnPath(returnTo), options());
    return { sent: true, method: 'link' as const, retryAfter: Math.ceil((60000 - elapsed) / 1000) };
  }
  await beforeSend?.();
  // The SDK creates a new verifier before asking the provider to send. Commit
  // it only after success so a throttled resend cannot break the previous link.
  const pending = new Map<string, string | null>();
  const staged: AuthCookies = {
    get: name => pending.has(name) ? (pending.get(name) ? { value: pending.get(name)! } : undefined) : store.get(name),
    set: (name, value) => { pending.set(name, value); },
    delete: name => { pending.set(name, null); },
  };
  const { error } = await linkClient(staged).auth.signInWithOtp({
    email, options: { shouldCreateUser: true, emailRedirectTo: `${origin()}/auth/callback` },
  });
  if (error) {
    if (error.code === 'over_email_send_rate_limit')
      throw new RateLimitError(60, 'Email delivery has reached its hourly limit. No new link was sent. Use the latest email already in your inbox, or try again later.');
    if (error.status === 429)
      throw new RateLimitError(60, 'Please wait before requesting another sign-in link. The link already in your inbox still works if it has not expired or been used.');
    if (error.code === 'email_address_not_authorized')
      throw new Error('Email sign-in is currently limited to the project team. Please contact support.');
    throw new Error('Unable to send the sign-in email. Please try again or contact support.');
  }
  for (const [name, value] of pending) {
    if (value === null) store.delete(name);
    else store.set(name, value, options());
  }
  store.set('paper_auth_email', email, options());
  store.set('paper_auth_return', authReturnPath(returnTo), options());
  store.set('paper_auth_sent_at', String(Date.now()), options());
  return { sent: true, method: 'link' as const, retryAfter: 60 };
}

export async function exchangeEmailLink(code: string, store: AuthCookies) {
  const email = store.get('paper_auth_email')?.value;
  if (!email || !store.get(verifierCookie) || !code || code.length > 2048)
    throw new Error('Sign in using a fresh link in the same browser where you requested it.');
  const { data, error } = await linkClient(store).auth.exchangeCodeForSession(code);
  if (error || !data.session || !data.user?.email_confirmed_at || data.user.email?.toLowerCase() !== email)
    throw new Error('Sign in using a fresh link. This link is invalid or expired.');
  return { email, returnTo: authReturnPath(store.get('paper_auth_return')?.value) };
}
