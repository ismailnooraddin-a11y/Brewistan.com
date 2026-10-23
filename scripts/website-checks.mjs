// Public website regressions: routing/helper execution, actual middleware with mocked adapters,
// and source contracts. No hosted Supabase/Vercel or OTP is contacted by this suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const ts = require(process.env.TYPESCRIPT_PATH || require.resolve('typescript', { paths: [path.join(root, 'apps/web')] }));
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
function load(name, imports = {}) {
  const result = ts.transpileModule(read(name), {
    fileName: name,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, name + ': syntax diagnostics');
  const module = { exports: {} };
  new Function('module', 'exports', 'require', result.outputText)(module, module.exports, id => {
    if (!(id in imports)) throw new Error('Unexpected dependency: ' + id);
    return imports[id];
  });
  return module.exports;
}
const routing = load('apps/web/lib/site-routing.ts');
const html = read('apps/web/public/website/index.html');
const css = read('apps/web/public/website/site.css');
const js = read('apps/web/public/website/site.js');
class CookieJar {
  constructor() { this.items = new Map(); }
  get(name) { return this.items.get(name); }
  getAll() { return [...this.items.values()]; }
  set(name, value, options = {}) {
    const cookie = typeof name === 'object' ? name : { name, value, ...options };
    this.items.set(cookie.name, cookie);
  }
}
class MockResponse extends Response {
  constructor(body, init) { super(body, init); this.cookies = new CookieJar(); }
  static next() { return new this(null, { headers: { 'x-middleware-next': '1' } }); }
  static rewrite(url) { return new this(null, { headers: { 'x-middleware-rewrite': String(url) } }); }
  static redirect(url) { return new this(null, { status: 307, headers: { Location: String(url) } }); }
}
function cloneableUrl(url) {
  const value = new URL(url);
  value.clone = () => cloneableUrl(String(value));
  return value;
}
async function middlewareRequest(host, pathname = '/', { signedIn = false, environment = 'production', forwardedHost } = {}) {
  const vars = ['ADMIN_HOST', 'OWNER_HOSTS', 'CUSTOMER_HOSTS', 'WEB_SESSION_SECRET', 'VERCEL_ENV'];
  const before = Object.fromEntries(vars.map(key => [key, process.env[key]]));
  let authCalls = 0;
  try {
    Object.assign(process.env, {
      ADMIN_HOST: 'admin.brewistan.com', OWNER_HOSTS: 'dashboard.brewistan.com',
      CUSTOMER_HOSTS: 'app.brewistan.com', WEB_SESSION_SECRET: 'website-test-session-secret-at-least-32-bytes',
      VERCEL_ENV: environment,
    });
    const { middleware } = load('apps/web/middleware.ts', {
      'next/server': { NextResponse: MockResponse },
      '@supabase/ssr': { createServerClient: () => {
        authCalls++;
        return {
          auth: {
            getUser: async () => ({ data: { user: signedIn ? { id: 'owner-id' } : null } }),
            getSession: async () => ({ data: { session: { access_token: 'verified-test-token' } } }),
            signOut: async () => ({}),
          },
          rpc: async () => ({ data: true, error: null }),
        };
      } },
      './lib/site-routing': routing,
      './lib/session-policy': {
        advanceSession: async () => 'test-cookie', contextFromVerifiedSession: () => ({ userId: 'owner-id' }),
      },
    });
    const headers = new Headers({ host });
    if (forwardedHost) headers.set('x-forwarded-host', forwardedHost);
    const response = await middleware({ nextUrl: cloneableUrl(`https://${host}${pathname}`), headers, cookies: new CookieJar() });
    return { response, authCalls };
  } finally {
    for (const key of vars) before[key] === undefined ? delete process.env[key] : process.env[key] = before[key];
  }
}

test('public and preview hosts display the marketing homepage', () => {
  for (const host of ['brewistan.com', 'www.brewistan.com', 'brewistan-com-l2as.vercel.app', 'localhost:3000']) {
    assert.equal(routing.siteEntry(host), 'marketing');
  }
});
test('customer, owner and configured admin roots stay separate', () => {
  assert.equal(routing.siteEntry('app.brewistan.com'), 'customer');
  assert.equal(routing.siteEntry('dashboard.brewistan.com'), 'owner');
  assert.equal(routing.siteEntry('admin.brewistan.com', { adminHost: 'admin.brewistan.com' }), 'admin');
});
test('host matching is exact, normalised and accepts configured aliases', () => {
  assert.equal(routing.siteEntry('APP.BREWISTAN.COM:443'), 'customer');
  assert.equal(routing.siteEntry('app.brewistan.com.evil.test'), 'marketing');
  assert.equal(routing.siteEntry('private.example', { ownerHosts: 'dashboard.brewistan.com, private.example' }), 'owner');
  assert.equal(routing.normaliseHost('WWW.BREWISTAN.COM.:443'), 'www.brewistan.com');
});
test('search engines are allowed only on the canonical public hosts', () => {
  for (const host of ['app.brewistan.com', 'dashboard.brewistan.com', 'admin.brewistan.com', 'preview.vercel.app', 'localhost']) {
    assert.equal(routing.isIndexableMarketingHost(host), false);
  }
  assert.equal(routing.isIndexableMarketingHost('www.brewistan.com'), true);
});
test('owner login destinations are a fixed allowlist, not user-controlled URLs', () => {
  assert.equal(routing.afterOwnerLogin(true, true), '/');
  assert.equal(routing.afterOwnerLogin(false, true), '/onboarding');
  assert.equal(routing.afterOwnerLogin(false, false), '/dashboard');
});
test('actual middleware rewrites marketing before any authentication request', async () => {
  const { response, authCalls } = await middlewareRequest('brewistan.com');
  assert.equal(authCalls, 0);
  assert.equal(response.headers.get('x-middleware-rewrite'), 'https://brewistan.com/website/index.html');
  assert.equal(response.headers.get('Content-Security-Policy'), routing.marketingCsp);
  assert.equal(response.headers.get('X-Robots-Tag'), null);
});
test('preview marketing works without Supabase and is noindexed', async () => {
  const { response, authCalls } = await middlewareRequest('preview.vercel.app', '/', { environment: 'preview' });
  assert.equal(authCalls, 0);
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow');
});
test('customer root still redirects to the customer wallet', async () => {
  const { response, authCalls } = await middlewareRequest('app.brewistan.com');
  assert.equal(authCalls, 0);
  assert.equal(response.headers.get('Location'), 'https://app.brewistan.com/cards');
});
test('owner root redirects to the protected dashboard path', async () => {
  const { response } = await middlewareRequest('dashboard.brewistan.com');
  assert.equal(response.headers.get('Location'), 'https://dashboard.brewistan.com/dashboard');
});
test('dashboard and onboarding still require authentication on public hosts', async () => {
  for (const route of ['/dashboard', '/dashboard/branding', '/onboarding']) {
    const { response, authCalls } = await middlewareRequest('brewistan.com', route);
    assert.equal(authCalls, 1);
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('Location'), 'https://brewistan.com/login');
    assert.equal(response.headers.get('Content-Security-Policy'), null);
  }
});
test('admin root stays protected and admin routes remain blocked on other hosts', async () => {
  const admin = await middlewareRequest('admin.brewistan.com');
  assert.equal(admin.response.headers.get('Location'), 'https://admin.brewistan.com/login');
  const publicAdmin = await middlewareRequest('brewistan.com', '/admin');
  assert.equal(publicAdmin.response.status, 404);
});
test('forwarded-host cannot route a public request into the admin panel', async () => {
  const { response } = await middlewareRequest('brewistan.com', '/admin', { forwardedHost: 'admin.brewistan.com' });
  assert.equal(response.status, 404);
});
test('signed-in cafe signup goes to onboarding, ordinary owner login to dashboard', async () => {
  const signup = await middlewareRequest('dashboard.brewistan.com', '/login?signup=cafe&next=https://evil.test', { signedIn: true });
  assert.equal(signup.response.headers.get('Location'), 'https://dashboard.brewistan.com/onboarding');
  const login = await middlewareRequest('dashboard.brewistan.com', '/login', { signedIn: true });
  assert.equal(login.response.headers.get('Location'), 'https://dashboard.brewistan.com/dashboard');
  const admin = await middlewareRequest('admin.brewistan.com', '/login?signup=cafe', { signedIn: true });
  assert.equal(admin.response.headers.get('Location'), 'https://admin.brewistan.com/');
});
test('customer routes and QR URLs are not intercepted by the marketing page', async () => {
  for (const route of ['/cards', '/cards/cafe-id', '/c/cafe/branch', '/scan', '/manifest.webmanifest', '/sw.js']) {
    const { response, authCalls } = await middlewareRequest('app.brewistan.com', route);
    assert.equal(authCalls, 0);
    assert.equal(response.headers.get('x-middleware-next'), '1');
  }
});
test('marketing static files do not need an account and standalone HTML is noindexed', async () => {
  for (const route of ['/website/index.html', '/website/site.css', '/website/site.js']) {
    const { response, authCalls } = await middlewareRequest('brewistan.com', route);
    assert.equal(authCalls, 0);
    assert.equal(response.headers.get('x-middleware-next'), '1');
    if (route.endsWith('.html')) assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  }
});
test('robots disallows private surfaces without blocking public CSS and JS', async () => {
  const result = await middlewareRequest('brewistan.com', '/robots.txt');
  assert.equal(result.authCalls, 0);
  const text = await result.response.text();
  assert.match(text, /Sitemap: https:\/\/brewistan\.com\/sitemap\.xml/);
  assert.doesNotMatch(text, /Disallow: \/website\/\n/);
  assert.match(text, /Disallow: \/dashboard/);
  const privateHost = await middlewareRequest('app.brewistan.com', '/robots.txt');
  assert.equal(await privateHost.response.text(), 'User-agent: *\nDisallow: /\n');
});
test('sitemap contains only the public homepage', async () => {
  const { response } = await middlewareRequest('brewistan.com', '/sitemap.xml');
  const xml = await response.text();
  assert.match(xml, /<loc>https:\/\/brewistan\.com\/<\/loc>/);
  assert.equal((xml.match(/<loc>/g) || []).length, 1);
});
test('all six signup calls to action target cafe-owner onboarding', () => {
  const anchors = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  const ctas = anchors.filter(([, , content]) => /sign up/i.test(content));
  assert.equal(ctas.length, 6);
  assert.ok(ctas.every(([, href]) => href === 'https://dashboard.brewistan.com/login?signup=cafe'));
  assert.ok(!anchors.some(([, href]) => /app\.brewistan\.com\/(cards|scan|c\/)/.test(href)));
});
test('public timing estimates and planned integrations are honestly labelled', () => {
  assert.match(html, /Illustrative design targets, not measured or guaranteed completion times/);
  assert.match(html, /First-customer signup target/);
  assert.match(html, /Returning scan \+ confirmation target/);
  assert.match(html, /planned integrations and are not included today/);
  assert.equal((html.match(/class="planned-tag"/g) || []).length, 2);
  assert.match(html, /trial begins after approval/);
  assert.doesNotMatch(html, /(?:50,000|100,000|250,000)\s*(?:IQD|dinar)/i);
});
test('marketing scripts use no account, storage, network or inline executable code', () => {
  assert.doesNotMatch(js, /\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage|supabase)\b/);
  assert.doesNotMatch(html, /\son(?:click|load|error|submit)\s*=/i);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
  assert.doesNotMatch(html, /\sstyle\s*=/i);
  assert.doesNotMatch(routing.marketingCsp, /unsafe-inline|unsafe-eval/);
});
test('accessibility hooks, no-JS details, reduced motion and unique IDs exist', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const match of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(match[1]), match[1]);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(css, /prefers-reduced-motion/);
  assert.ok((html.match(/<details/g) || []).length >= 8);
});
test('owner login page handles signup copy without changing database roles', () => {
  const login = read('apps/web/app/login/page.tsx');
  const form = read('apps/web/app/login/LoginForm.tsx');
  assert.match(login, /signup === 'cafe' && !isAdmin/);
  assert.match(login, /postLoginPath=\{afterOwnerLogin/);
  assert.match(form, /window\.location\.href = postLoginPath/);
  assert.doesNotMatch(login + form, /role\s*:\s*['"]owner['"]/);
});
