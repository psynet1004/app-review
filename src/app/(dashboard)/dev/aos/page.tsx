'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import DataTable from '@/components/table/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Send, SendHorizonal, Plus, X } from 'lucide-react';
import type { DevItem, Developer, DevStatus, SendStatus } from '@/lib/types/database';

const PLATFORM = 'AOS';

export default function AosDevPage() {
  const supabase = createClient();
  const [items, setItems] = useState<DevItem[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [itemsRes, devsRes] = await Promise.all([
      supabase.from('dev_items').select('*, developers(name)').eq('platform', PLATFORM).order('created_at', { ascending: false }),
      supabase.from('developers').select('*').eq('is_active', true).in('platform', [PLATFORM, 'COMMON']),
    ]);
    setItems(itemsRes.data || []);
    setDevelopers(devsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime
  useEffect(() => {
    const channel = supabase.channel('dev-items-aos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dev_items', filter: `platform=eq.${PLATFORM}` }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const handleSendSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}건을 AOS 개발방으로 전송할까요?`)) return;
    setSending(true);
    try {
      const res = await fetch('/api/send/dev-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: Array.from(selectedIds), platform: PLATFORM }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`${data.count}건 전송 완료!`);
        setSelectedIds(new Set());
        loadData();
      } else {
        alert(`전송 실패: ${data.error}`);
      }
    } catch { alert('전송 중 오류 발생'); }
    setSending(false);
  };

  const handleSendUnsent = async () => {
    const unsent = items.filter(i => i.send_status === '미전송');
    if (unsent.length === 0) { alert('미전송 항목이 없습니다'); return; }
    if (!confirm(`미전송 ${unsent.length}건을 전체 전송할까요?`)) return;
    setSending(true);
    try {
      const res = await fetch('/api/send/dev-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: unsent.map(i => i.id), platform: PLATFORM }),
      });
      const data = await res.json();
      if (data.success) { alert(`${data.count}건 전송 완료!`); loadData(); }
      else alert(`전송 실패: ${data.error}`);
    } catch { alert('전송 중 오류 발생'); }
    setSending(false);
  };

  const columns = [
    { key: 'version', label: '버전', width: 'w-20', sortable: true },
    { key: 'menu_item', label: '항목', sortable: true, render: (item: DevItem) => (
      <button onClick={() => setEditId(item.id)} className="text-blue-600 hover:underline font-medium text-left">{item.menu_item}</button>
    )},
    { key: 'description', label: '상세설명', width: 'max-w-xs', render: (item: DevItem) => (
      <span className="text-gray-500 text-xs line-clamp-2">{item.description || '-'}</span>
    )},
    { key: 'is_required', label: '필수', width: 'w-14', render: (item: DevItem) => (
      item.is_required ? <span className="text-xs font-medium text-blue-600">필수</span> : <span className="text-xs text-gray-400">-</span>
    )},
    { key: 'department', label: '부서', width: 'w-20', sortable: true },
    { key: 'requester', label: '담당자', width: 'w-20' },
    { key: 'developer', label: '개발담당', width: 'w-20', render: (item: DevItem) => item.developers?.name || <span className="text-gray-300">미배정</span> },
    { key: 'dev_status', label: '개발결과', width: 'w-24', sortable: true, render: (item: DevItem) => <StatusBadge status={item.dev_status} type="dev" /> },
    { key: 'send_status', label: '전송', width: 'w-20', sortable: true, render: (item: DevItem) => <StatusBadge status={item.send_status} type="send" /> },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">AOS 개발항목</h1>
        <button onClick={() => { setEditId(null); setShowForm(true); }}
          className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={16}/> 항목 추가
        </button>
      </div>

      <DataTable
        data={items}
        columns={columns}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        searchKeys={['menu_item', 'description', 'department', 'requester']}
        searchPlaceholder="항목명, 설명, 부서 검색..."
        emptyMessage={loading ? '로딩 중...' : '등록된 개발항목이 없습니다'}
        toolbar={
          <div className="flex items-center gap-2">
            <button onClick={handleSendSelected} disabled={selectedIds.size === 0 || sending}
              className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <Send size={13}/> 선택 전송 {selectedIds.size > 0 && `(${selectedIds.size})`}
            </button>
            <button onClick={handleSendUnsent} disabled={sending}
              className="flex items-center gap-1.5 bg-gray-700 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors">
              <SendHorizonal size={13}/> 미전송 전체 전송
            </button>
          </div>
        }
      />

      {/* Form Modal */}
      {(showForm || editId) && (
        <ItemFormModal
          supabase={supabase}
          developers={developers}
          editId={editId}
          platform={PLATFORM}
          onClose={() => { setShowForm(false); setEditId(null); }}
          onSaved={() => { setShowForm(false); setEditId(null); loadData(); }}
        />
      )}
    </div>
  );
}

// ─── Item Form Modal ───
function ItemFormModal({ supabase, developers, editId, platform, onClose, onSaved }: {
  supabase: any; developers: Developer[]; editId: string | null; platform: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    version: '', menu_item: '', description: '', is_required: false,
    department: '', requester: '', developer_id: '', dev_status: '대기' as DevStatus, note: '',
    planning_link: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editId) {
      supabase.from('dev_items').select('*').eq('id', editId).single().then(({ data }: any) => {
        if (data) setForm({
          version: data.version || '', menu_item: data.menu_item || '', description: data.description || '',
          is_required: data.is_required || false, department: data.department || '', requester: data.requester || '',
          developer_id: data.developer_id || '', dev_status: data.dev_status || '대기', note: data.note || '',
          planning_link: data.planning_link || '',
        });
      });
    }
  }, [editId]);

  const handleSave = async () => {
    if (!form.menu_item.trim()) { alert('항목명을 입력하세요'); return; }
    setSaving(true);
    const payload = { ...form, platform, developer_id: form.developer_id || null };

    if (editId) {
      await supabase.from('dev_items').update(payload).eq('id', editId);
    } else {
      await supabase.from('dev_items').insert(payload);
    }
    setSaving(false);
    onSaved();
  };

  const handleDelete = async () => {
    if (!editId || !confirm('이 항목을 삭제할까요?')) return;
    await supabase.from('dev_items').delete().eq('id', editId);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{editId ? '항목 수정' : '새 항목 추가'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18}/></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="버전" value={form.version} onChange={v => setForm(f => ({ ...f, version: v }))} placeholder="V51.0.3" />
            <Field label="항목명 *" value={form.menu_item} onChange={v => setForm(f => ({ ...f, menu_item: v }))} placeholder="UFC 비교탭 활성화" />
          </div>
          <Field label="상세설명" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} multiline placeholder="개발 상세 내용..." />
          <div className="grid grid-cols-2 gap-4">
            <Field label="부서" value={form.department} onChange={v => setForm(f => ({ ...f, department: v }))} placeholder="전략기획" />
            <Field label="담당자" value={form.requester} onChange={v => setForm(f => ({ ...f, requester: v }))} placeholder="이재규" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">개발담당자</label>
              <select value={form.developer_id} onChange={e => setForm(f => ({ ...f, developer_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">미배정</option>
                {developers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.platform})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">개발결과</label>
              <select value={form.dev_status} onChange={e => setForm(f => ({ ...f, dev_status: e.target.value as DevStatus }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                {['대기','개발중','개발완료','검수요청','보류'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_required} onChange={e => setForm(f => ({ ...f, is_required: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            필수 개발 항목
          </label>
          <Field label="기획 링크" value={form.planning_link} onChange={v => setForm(f => ({ ...f, planning_link: v }))} placeholder="https://..." />
          <Field label="비고" value={form.note} onChange={v => setForm(f => ({ ...f, note: v }))} multiline placeholder="참고사항..." />
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          {editId ? <button onClick={handleDelete} className="text-red-500 text-sm hover:underline">삭제</button> : <div/>}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? '저장 중...' : editId ? '수정' : '추가'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  const cls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} className={cls} />
        : <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      }
    </div>
  );
}
