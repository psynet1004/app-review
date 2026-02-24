import type { DevItem, BugItem, CommonBug, ServerBug } from '@/lib/types/database';

export async function sendToWebhook(webhookUrl: string, message: string): Promise<boolean> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message }),
  });
  return response.ok;
}

export function formatDevItemMessage(items: DevItem[], platform: string, version: string): string {
  const header = `📋 [개발항목 알림] ${platform} ${version}\n`;
  const divider = '━'.repeat(30);

  const body = items.map(item => [
    divider,
    `📌 항목: ${item.menu_item}`,
    item.description ? `📝 상세: ${item.description}` : '',
    `👤 개발담당: ${item.developers?.name || '미배정'}`,
    `🏢 부서: ${item.department || '-'} / 요청자: ${item.requester || '-'}`,
    `⚡ 필수: ${item.is_required ? '예' : '아니오'}`,
  ].filter(Boolean).join('\n')).join('\n');

  const footer = `\n${divider}\n🔗 바로가기: ${process.env.NEXT_PUBLIC_APP_URL}/dev/${platform.toLowerCase()}`;

  return header + body + footer;
}

export function formatBugMessage(items: (BugItem | CommonBug | ServerBug)[], type: string, version: string): string {
  const header = `🐛 [${type} 알림] ${version}\n`;
  const divider = '━'.repeat(30);

  const body = items.map(item => {
    const priorityEmoji = { '긴급': '🔴', '높음': '🟠', '보통': '🟡', '낮음': '🟢' };
    return [
      divider,
      `${priorityEmoji[item.priority as keyof typeof priorityEmoji] || '🟡'} 우선순위: ${item.priority}`,
      `📍 위치: ${item.location}`,
      item.description ? `📝 상세: ${item.description}` : '',
      `👤 보고자: ${'reporter' in item ? item.reporter : '-'}`,
      `👨‍💻 개발담당: ${item.developers?.name || '미배정'}`,
    ].filter(Boolean).join('\n');
  }).join('\n');

  const footer = `\n${divider}\n🔗 바로가기: ${process.env.NEXT_PUBLIC_APP_URL}/bugs`;

  return header + body + footer;
}
