import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { advanceSession, contextFromVerifiedSession } from './lib/session-policy';
const SESSION = 'bw_session';

const PUBLIC_PATHS = ['/login', '/privacy', '/terms'];

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = (request.headers.get('host') ?? '').split(':')[0];

  // Customer app (brewistan.com/c/..., /cards, /scan). Customers stay signed in through their own
  // browser session and never use the café-owner session rules below.
  const customerHosts = (process.env.CUSTOMER_HOSTS ?? 'brewistan.com,www.brewistan.com').split(',').map((h) => h.trim());
  if (customerHosts.includes(host) && url.pathname === '/') {
    url.pathname = '/cards';
    return NextResponse.redirect(url);
  }
  if (isCustomerPath(url.pathname)) return NextResponse.next();
  const adminHost = process.env.ADMIN_HOST;
  const isAdminHost = !!adminHost && host === adminHost;

  // Host routing: the admin panel exists only on ADMIN_HOST.
  if (adminHost && !isAdminHost && url.pathname.startsWith('/admin')) {
    return new NextResponse('Not found', { status: 404 });
  }
  let rewriteTo: URL | null = null;
  if (isAdminHost && !url.pathname.startsWith('/admin') && !PUBLIC_PATHS.includes(url.pathname) && url.pathname !== '/logout') {
    rewriteTo = url.clone();
    rewriteTo.pathname = '/admin' + (url.pathname === '/' ? '' : url.pathname);
  }

  let response = rewriteTo ? NextResponse.rewrite(rewriteTo) : NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = rewriteTo ? NextResponse.rewrite(rewriteTo, { request }) : NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            const { maxAge, expires: _e, ...rest } = options;
            response.cookies.set(name, value, maxAge === 0 ? options : { ...rest, sameSite: 'lax' });
          });
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = rewriteTo?.pathname ?? url.pathname;
  const isPublic = PUBLIC_PATHS.includes(url.pathname);
  const secure = process.env.NODE_ENV === 'production';

  if (user) {
    const secret = process.env.WEB_SESSION_SECRET ?? '';
    if (secret.length < 32) return new NextResponse('Session security is not configured.', { status: 503 });
    // getUser above validates the auth token remotely. Only then inspect its AMR claims.
    const { data: { session } } = await supabase.auth.getSession();
    const context = session ? contextFromVerifiedSession(session.access_token, user.id) : null;
    const cookie = context ? await advanceSession(request.cookies.get(SESSION)?.value, context, secret) : null;
    const serverSession = cookie ? await supabase.rpc('touch_web_session') : null;
    if (serverSession?.error) return new NextResponse('Session verification unavailable.', { status: 503 });
    if (!cookie || serverSession?.data !== true) {
      await supabase.auth.signOut({ scope: 'local' });
      const login = url.clone(); login.pathname = '/login'; login.search = '?expired=1';
      const redirect = NextResponse.redirect(login);
      response.cookies.getAll().forEach(c => redirect.cookies.set(c));
      request.cookies.getAll().filter(c => c.name.startsWith('sb-')).forEach(c => redirect.cookies.set(c.name, '', {maxAge:0,path:'/'}));
      for (const name of [SESSION, 'bw_session_start', 'bw_last_seen']) redirect.cookies.set(name, '', {maxAge:0,path:'/'});
      return redirect;
    }
    response.cookies.set(SESSION, cookie, { httpOnly:true, sameSite:'lax', secure, path:'/' });

    if (url.pathname === '/login') {
      const home = url.clone();
      home.pathname = isAdminHost ? '/' : '/dashboard';
      home.search = '';
      const redirect = NextResponse.redirect(home);
      response.cookies.getAll().forEach(c => redirect.cookies.set(c));
      return redirect;
    }
  } else if (!isPublic && (path.startsWith('/dashboard') || path.startsWith('/onboarding') || path.startsWith('/admin') || path === '/')) {
    const login = url.clone();
    login.pathname = '/login';
    login.search = '';
    const redirect = NextResponse.redirect(login);
    response.cookies.getAll().forEach(c => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}

function isCustomerPath(path: string): boolean {
  return path === '/cards' || path.startsWith('/cards/') || path.startsWith('/c/') || path === '/scan' ||
    path === '/sw.js' || path === '/manifest.webmanifest' || path === '/offline.html';
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
};
