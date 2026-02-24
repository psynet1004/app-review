'use client';

// iOS 개발항목 - AOS와 동일 구조, platform만 다름
// 실제 프로젝트에서는 공통 컴포넌트로 추출하는 것을 권장합니다

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import DataTable from '@/components/table/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Send, SendHorizonal, Plus } from 'lucide-react';
import type { DevItem, Developer } from '@/lib/types/database';

const PLATFORM = 'iOS';

export default function IosDevPage() {
  const supabase = createClient();
  const [items, setItems] = useState<DevItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const { data } = await supabase.from('dev_items').select('*, developers(name)').eq('platform', PLATFORM).order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const ch = supabase.channel('dev-items-ios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dev_items', filter: `platform=eq.${PLATFORM}` }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadData]);

  const handleSendSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}건을 iOS 개발방으로 전송할까요?`)) return;
    setSending(true);
    const res = await fetch('/api/send/dev-items', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds: Array.from(selectedIds), platform: PLATFORM }) });
    const data = await res.json();
    alert(data.success ? `${data.count}건 전송 완료!` : `전송 실패: ${data.error}`);
    if (data.success) { setSelectedIds(new Set()); loadData(); }
    setSending(false);
  };

  const columns = [
    { key: 'version', label: '버전', width: 'w-20', sortable: true },
    { key: 'menu_item', label: '항목', sortable: true },
    { key: 'description', label: '상세설명', width: 'max-w-xs', render: (i: DevItem) => <span className="text-gray-500 text-xs line-clamp-2">{i.description || '-'}</span> },
    { key: 'is_required', label: '필수', width: 'w-14', render: (i: DevItem) => i.is_required ? <span className="text-xs font-medium text-blue-600">필수</span> : <span className="text-xs text-gray-400">-</span> },
    { key: 'department', label: '부서', width: 'w-20', sortable: true },
    { key: 'developer', label: '개발담당', width: 'w-20', render: (i: DevItem) => i.developers?.name || <span className="text-gray-300">미배정</span> },
    { key: 'dev_status', label: '개발결과', width: 'w-24', sortable: true, render: (i: DevItem) => <StatusBadge status={i.dev_status} type="dev" /> },
    { key: 'send_status', label: '전송', width: 'w-20', render: (i: DevItem) => <StatusBadge status={i.send_status} type="send" /> },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">iOS 개발항목</h1>
      <DataTable data={items} columns={columns} selectable selectedIds={selectedIds} onSelectionChange={setSelectedIds}
        searchKeys={['menu_item','description','department']} searchPlaceholder="검색..."
        emptyMessage={loading ? '로딩 중...' : '등록된 개발항목이 없습니다'}
        toolbar={
          <button onClick={handleSendSelected} disabled={selectedIds.size===0||sending}
            className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors">
            <Send size={13}/> 선택 전송 {selectedIds.size > 0 && `(${selectedIds.size})`}
          </button>
        }
      />
    </div>
  );
}
