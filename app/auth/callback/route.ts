import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeRedirect } from '@/lib/utils';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeRedirect(searchParams.get('next'), '/dashboard');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error) {
    return NextResponse.redirect(
      `${origin}/get-started?error=${encodeURIComponent(errorDescription || error)}`,
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return NextResponse.redirect(
        `${origin}/get-started?error=${encodeURIComponent(exchangeError.message)}`,
      );
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
