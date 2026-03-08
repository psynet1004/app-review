import { createServerSupabase } from '@/lib/supabase/server';
import { sendToWebhook, formatBugMessage } from '@/lib/chat/webhook';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const { itemIds, platform } = await request.json();
    if (!itemIds?.length) {
      return NextResponse.json({ error: '전송할 항목을 선택하세요' }, { status: 400 });
    }

    const { data: items, error } = await supabase
      .from('bug_items')
      .select('*, developers(name)')
      .in('id', itemIds);

    if (error || !items?.length) {
      return NextResponse.json({ error: '항목을 찾을 수 없습니다' }, { status: 404 });
    }

    // 플랫폼별 라우팅
    const platforms = platform === 'COMMON' ? ['AOS', 'iOS'] : [platform];
    let allSuccess = true;

    for (const p of platforms) {
      const { data: webhook } = await supabase
        .from('webhook_configs')
        .select('*')
        .eq('target_platform', p)
        .eq('is_active', true)
        .single();

      if (webhook) {
        const version = items[0]?.version || '';
        const message = formatBugMessage(items, '앱 오류', version);
        const success = await sendToWebhook(webhook.webhook_url, message);
        if (!success) allSuccess = false;
      }
    }

    if (allSuccess) {
      await supabase.from('bug_items').update({ send_status: '전송완료' }).in('id', itemIds);
    }

    await supabase.from('send_logs').insert({
      sent_by: user.id,
      sent_by_email: user.email,
      send_type: '앱오류',
      target_platform: platforms.join('+'),
      target_space: platforms.map(p => `${p} 개발방`).join(', '),
      item_count: items.length,
      item_summary: items.map(i => i.location).join(', ').slice(0, 200),
      result: allSuccess ? '성공' : '실패',
    });

    return NextResponse.json({ success: allSuccess, count: items.length });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
