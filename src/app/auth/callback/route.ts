import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// 허용된 이메일 목록
const ALLOWED_EMAILS = [
  'spirit@psynet.co.kr','khp4981@psynet.co.kr','hak703@psynet.co.kr','ksb@psynet.co.kr',
  'youngmin178@psynet.co.kr','jhshin@psynet.co.kr','thkang@psynet.co.kr',
  'jhpark@psynet.co.kr','xhermes2013@psynet.co.kr','junholee940930@psynet.co.kr',
  'boongss@psynet.co.kr','coldfrequencies@psynet.co.kr','yeahoneshin@psynet.co.kr',
  'dbstlrchl@psynet.co.kr','dklim@psynet.co.kr','heuswing@psynet.co.kr','mcyang@psynet.co.kr',
  'annasui89@psynet.co.kr','somin99@psynet.co.kr','wndydthdyd@psynet.co.kr',
  'humancom@psynet.co.kr','jaebin9810@psynet.co.kr','parkkn@psynet.co.kr','poohsik@psynet.co.kr','probe35331@psynet.co.kr',
  'kjs@psynet.co.kr','jh@psynet.co.kr','pommier19@psynet.co.kr',
];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // 이메일 체크
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email?.toLowerCase();

      if (email && ALLOWED_EMAILS.includes(email)) {
        return NextResponse.redirect(`${origin}${next}`);
      }

      // 허용되지 않은 이메일 → 로그아웃 후 에러
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=unauthorized`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
