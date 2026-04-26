import { Suspense } from 'react';
import { GetStartedForm } from './GetStartedForm';

export const metadata = { title: 'Get started · Brewistan' };
export const dynamic = 'force-dynamic';

export default function GetStartedPage() {
  return (
    <Suspense fallback={<div className="auth-layout"><main className="auth-main" /></div>}>
      <GetStartedForm />
    </Suspense>
  );
}
