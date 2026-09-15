import { NextRequest, NextResponse } from 'next/server';
import { completeSignIn } from '@/server/auth';
import { origin } from '@/server/config';
import { cookies } from 'next/headers';
import { authReturnPath } from '@/lib/auth-return';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const store = await cookies();
  const savedReturn = store.get('paper_google_return')?.value || store.get('paper_auth_return')?.value;
  let destination = `${authReturnPath(savedReturn)}&signin=retry`;
  try {
    destination = await completeSignIn(request.nextUrl.searchParams.get('code') || '');
  } catch {
    // Never log codes, provider tokens, or link URLs.
  }
  const response = NextResponse.redirect(new URL(destination, origin()), 303);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
