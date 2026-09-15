# Google sign-in with Supabase

Production offers Continue with Google. Vercel hosts the website and Supabase
handles the Google authorization exchange. Google credentials are stored only
in the Supabase Google provider settings; no Resend key or SMTP is needed for
Google login. Local development retains its simulated email-code form.

## Configuration

- Google application type: Web application.
- Authorized JavaScript origin: `https://newyorkcity-kappa.vercel.app`
- Google authorized redirect URI: `https://mgbchdkttxrrjywqgybh.supabase.co/auth/v1/callback`
- Supabase Site URL: `https://newyorkcity-kappa.vercel.app`
- Supabase allowed app redirect: `https://newyorkcity-kappa.vercel.app/auth/callback`
- Enable Google in Supabase and save the Google Client ID and Client Secret there.
- For public access, configure the Google audience appropriately. If the app is
  in Testing, add the intended test users; publish the OAuth app when ready.

`node scripts/configure-supabase-auth.mjs` reads back these Supabase settings
and reports whether Google is enabled and credentials are present, without
printing credentials. `--apply` only updates Site URL and allowed redirects.

## Flow and preservation

The browser saves the editor draft before POSTing to `/api/auth/google`.
The endpoint checks the request origin, rate-limits starts, and creates a PKCE
authorization URL. Its verifier stays in an HttpOnly, SameSite=Lax cookie.
Google returns through Supabase to `/auth/callback`, where the app checks the
verified Google identity, creates its opaque HttpOnly session, and associates
the anonymous draft and uploads with the account. Provider access and refresh
tokens are not stored in the browser. Existing app accounts are matched by
verified email, preserving their placements and account role.

Destinations are rebuilt from allowed billboard, editor, checkout, and account
routes. Cancellation returns to sign-in with the saved destination. Retrying
waits for draft loading before saving it again. Old email-link callbacks remain
supported, but production no longer presents the email-send form.

## Verification

- `npx tsx --test tests/auth-provider.test.ts tests/api-client.test.ts`
- `npm run typecheck`
- `node scripts/verify-google-sign-in.mjs`

The isolated browser fixture checks Google redirects, PKCE, verified sessions,
cancellation recovery, saved drafts, checkout destinations, mobile UI, and
rejected cross-origin requests. It sends no emails and touches no hosted data.
It also checks profile clicks during session loading, account-request failure
and retry, and cross-tab sign-in/sign-out on focus. The profile always refreshes
the server session before deciding whether sign-in is necessary; a failed lookup
shows retry rather than treating the user as signed out. Focus and page restoration
refresh account state. A signed-in account has an initial avatar in the header.
The Google button uses the official multicolor logo and self-hosted Google Sans.
The older `verify-email-link.mjs` documents the previous email UI and is no
longer the browser acceptance command for production sign-in.

A real Google account login must also be checked on the deployed website to
confirm Google's consent/audience configuration. Automated fixture checks do
not exercise a real user's Google consent.
