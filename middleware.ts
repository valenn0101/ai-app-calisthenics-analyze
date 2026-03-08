import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'formcheck_user';
const PUBLIC = ['/login', '/api/auth/'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const user = req.cookies.get(COOKIE_NAME)?.value;
  const isPublic = PUBLIC.some(p => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && pathname === '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
