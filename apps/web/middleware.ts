import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { advanceSession, contextFromVerifiedSession } from './lib/session-policy';
import { afterOwnerLogin, isIndexableMarketingHost, isMarketingAssetPath, marketingCsp, normaliseHost, siteEntry } from './lib/site-routing';
const SESSION = 'bw_session';

const PUBLIC_PATHS = ['/login', '/privacy', '/terms'];

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = normaliseHost(request.headers.get('host') ?? '');
  const entry = siteEntry(host, {
    customerHosts: process.env.CUSTOMER_HOSTS,
    ownerHosts: process.env.OWNER_HOSTS,
    adminHost: process.env.ADMIN_HOST,
  });

  // Pure public files must never depend on Supabase or an existing account session.
  // Only the root is rewritten; customer, owner and admin paths retain their guards.
  if (url.pathname === '/' && entry === 'marketing') {
    const target = url.clone();
    target.pathname = '/website/index.html';
    const publicResponse = NextResponse.rewrite(target);
    publicResponse.headers.set('Content-Security-Policy', marketingCsp);
    publicResponse.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    if (!isIndexableMarketingHost(host) || process.env.VERCEL_ENV === 'preview') {
      publicResponse.headers.set('X-Robots-Tag', 'noindex, nofollow');
    }
    return publicResponse;
  }
  if (url.pathname === '/' && entry === 'owner') {
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }
  if (url.pathname === '/robots.txt') {
    const canIndex = isIndexableMarketingHost(host) && process.env.VERCEL_ENV !== 'preview';
    const robots = canIndex
      ? 'User-agent: *\nAllow: /$\nDisallow: /website/index.html\nDisallow: /dashboard\nDisallow: /admin\nDisallow: /cards\nDisallow: /c/\nDisallow: /scan\nDisallow: /login\nDisallow: /onboarding\nDisallow: /ownership\nDisallow: /logout\nSitemap: https://brewistan.com/sitemap.xml\n'
      : 'User-agent: *\nDisallow: /\n';
    return new NextResponse(robots, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  if (url.pathname === '/sitemap.xml') {
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://brewistan.com/</loc></url></urlset>', {
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'X-Robots-Tag': 'noindex' },
    });
  }
  if (isMarketingAssetPath(url.pathname)) {
    const publicResponse = NextResponse.next();
    publicResponse.headers.set('Content-Security-Policy', marketingCsp);
    if (url.pathname.endsWith('.html')) publicResponse.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return publicResponse;
  }

  // Customer app (app.brewistan.com/c/..., /cards, /scan). Customers stay signed in through their own
  // browser session and never use the café-owner session rules below.
  if (entry === 'customer' && url.pathname === '/') {
    url.pathname = '/cards';
    return NextResponse.redirect(url);
  }
  if (isCustomerPath(url.pathname)) return NextResponse.next();
  const adminHost = process.env.ADMIN_HOST ? normaliseHost(process.env.ADMIN_HOST) : undefined;
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
      home.pathname = afterOwnerLogin(isAdminHost, url.searchParams.get('signup') === 'cafe');
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
