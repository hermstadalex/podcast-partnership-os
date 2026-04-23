import { NextResponse } from 'next/server';

import { E2E_AUTH_COOKIE_NAME, isE2EBypassEnabled } from '@/lib/e2e-auth';

export async function GET(request: Request) {
  if (!isE2EBypassEnabled()) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const response = NextResponse.redirect(new URL('/', request.url));
  response.cookies.set(E2E_AUTH_COOKIE_NAME, 'admin', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });

  return response;
}
