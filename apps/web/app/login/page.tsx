import { LoginForm } from './LoginForm';
import { getT } from '@/lib/server-context';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { locale, t } = await getT();
  const { expired } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="font-display text-4xl text-cream">Brewistan</div>
          <div className="mt-2 text-xs uppercase tracking-[0.3em] text-gold">Cafe loyalty</div>
        </div>
        <div className="card">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">{t('login.title')}</h1>
              <p className="mt-1 text-sm text-ink-muted">{t('login.subtitle')}</p>
            </div>
            <LocaleSwitcher current={locale} />
          </div>
          {expired && <p className="mb-4 rounded-lg bg-warn/10 p-3 text-sm text-warn">{t('login.expired')}</p>}
          <LoginForm
            labels={{
              phone: t('login.phone'),
              send: t('login.send'),
              code: t('login.code'),
              verify: t('login.verify'),
              change: t('login.change'),
            }}
          />
        </div>
      </div>
    </main>
  );
}
