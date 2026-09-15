import { linkClient, type AuthCookies } from './email-link';
import { origin } from './config';
import { authReturnPath } from '../lib/auth-return';

export async function requestGoogleSignIn(returnTo: unknown, store: AuthCookies) {
  const { data, error } = await linkClient(store, true).auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin()}/auth/callback`, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw new Error('Google sign-in is unavailable. Please try again.');
  store.set('paper_google_return', authReturnPath(returnTo), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 3600,
  });
  return { url: data.url };
}

export async function exchangeGoogleSignIn(code: string, store: AuthCookies) {
  if (!store.get('paper_google_verifier') || !code || code.length > 2048)
    throw new Error('Sign in with Google again in this browser.');
  const { data, error } = await linkClient(store, true).auth.exchangeCodeForSession(code);
  const email = data.user?.email?.trim().toLowerCase();
  if (error || !data.session || !email || !data.user?.email_confirmed_at ||
      !data.user.identities?.some(identity => identity.provider === 'google'))
    throw new Error('Google sign-in could not be verified. Please try again.');
  return { email, returnTo: authReturnPath(store.get('paper_google_return')?.value) };
}
