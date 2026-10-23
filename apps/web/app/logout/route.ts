import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: 'local' });
  const response = NextResponse.redirect(new URL('/login', request.url), { status: 303 });
  response.cookies.set('bw_session_start', '', { maxAge: 0, path: '/' });
  response.cookies.set('bw_last_seen', '', { maxAge: 0, path: '/' });
  return response;
}
