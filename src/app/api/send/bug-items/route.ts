import { createServerSupabase } from '@/lib/supabase/server';
import { sendToWebhook, groupByDeveloper, formatBugMessageByDev } from '@/lib/chat/webhook';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const { itemIds, platform, table } = await request.json();
    if (!itemIds?.length) {
      return NextResponse.json({ error: '전송할 항목을 선택하세요' }, { status: 400 });
    }

    // table 파라미터로 어떤 테이블에서 조회할지 결정 (기본: bug_items)
    const tableName = table || 'bug_items';
    const sendType = tableName === 'common_bugs' ? '공통오류' : tableName === 'server_bugs' ? '서버오류' : '앱오류';

    const { data: items, error } = await supabase
      .from(tableName)
      .select('*, developers(name)')
      .in('id', itemIds);

    if (error || !items?.length) {
      return NextResponse.json({ error: '항목을 찾을 수 없습니다' }, { status: 404 });
    }

    // 플랫폼별 라우팅
    const platforms = platform === 'COMMON' ? ['AOS', 'iOS'] : platform === 'SERVER' ? ['AOS', 'iOS'] : [platform];
    let allSuccess = true;

    const version = items[0]?.version || '';
    const groups = groupByDeveloper(items);

    for (const p of platforms) {
      const { data: webhook } = await supabase
        .from('webhook_configs')
        .select('*')
        .eq('target_platform', p)
        .eq('is_active', true)
        .single();

      if (webhook) {
        // 개발담당별로 분리 전송
        for (const [devName, devItems] of groups) {
          const message = formatBugMessageByDev(devItems, sendType, version, devName);
          const success = await sendToWebhook(webhook.webhook_url, message);
          if (!success) allSuccess = false;
        }
      }
    }

    if (allSuccess) {
      await supabase.from(tableName).update({ send_status: '전송완료' }).in('id', itemIds);
    }

    const devNames = Array.from(groups.keys()).join(', ');
    await supabase.from('send_logs').insert({
      sent_by: user.id,
      sent_by_email: user.email,
      send_type: sendType,
      target_platform: platforms.join('+'),
      target_space: platforms.map(p => `${p} 개발방`).join(', '),
      item_count: items.length,
      item_summary: `[${devNames}] ${items.map(i => i.location).join(', ')}`.slice(0, 200),
      result: allSuccess ? '성공' : '실패',
    });

    return NextResponse.json({ success: allSuccess, count: items.length, groups: groups.size });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
