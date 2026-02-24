import { createServerSupabase } from '@/lib/supabase/server';
import { sendToWebhook, formatDevItemMessage } from '@/lib/chat/webhook';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const { itemIds, platform } = await request.json();
    if (!itemIds?.length || !platform) {
      return NextResponse.json({ error: '전송할 항목을 선택하세요' }, { status: 400 });
    }

    // 1. 항목 조회
    const { data: items, error: itemsError } = await supabase
      .from('dev_items')
      .select('*, developers(name)')
      .in('id', itemIds);

    if (itemsError || !items?.length) {
      return NextResponse.json({ error: '항목을 찾을 수 없습니다' }, { status: 404 });
    }

    // 2. Webhook URL 조회
    const { data: webhook } = await supabase
      .from('webhook_configs')
      .select('*')
      .eq('target_platform', platform)
      .eq('is_active', true)
      .single();

    if (!webhook) {
      return NextResponse.json({ error: `${platform} Webhook이 설정되지 않았습니다` }, { status: 404 });
    }

    // 3. 메시지 생성 및 전송
    const version = items[0]?.version || '';
    const message = formatDevItemMessage(items, platform, version);
    const success = await sendToWebhook(webhook.webhook_url, message);

    // 4. 전송상태 업데이트
    if (success) {
      await supabase
        .from('dev_items')
        .update({ send_status: '전송완료' })
        .in('id', itemIds);
    }

    // 5. 로그 기록
    await supabase.from('send_logs').insert({
      sent_by: user.id,
      sent_by_email: user.email,
      send_type: '개발항목',
      target_platform: platform,
      target_space: webhook.space_name,
      item_count: items.length,
      item_summary: items.map(i => i.menu_item).join(', ').slice(0, 200),
      result: success ? '성공' : '실패',
      error_message: success ? null : 'Webhook 전송 실패',
    });

    return NextResponse.json({ success, count: items.length });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
