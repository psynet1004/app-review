'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import DataTable from '@/components/table/DataTable';
import { StatusBadge, PriorityTag } from '@/components/common/StatusBadge';
import { Send, SendHorizonal, Plus, X } from 'lucide-react';
import type { BugItem, Developer, Priority, FixStatus } from '@/lib/types/database';

export default function BugsPage() {
  const supabase = createClient();
  const [items, setItems] = useState<BugItem[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [platformFilter, setPlatformFilter] = useState<string>('ALL');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [itemsRes, devsRes] = await Promise.all([
      supabase.from('bug_items').select('*, developers(name)').order('created_at', { ascending: false }),
      supabase.from('developers').select('*').eq('is_active', true),
    ]);
    setItems(itemsRes.data || []);
    setDevelopers(devsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const ch = supabase.channel('bug-items').on('postgres_changes', { event: '*', schema: 'public', table: 'bug_items' }, () => loadData()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadData]);

  const filtered = platformFilter === 'ALL' ? items : items.filter(i => i.platform === platformFilter);

  const handleSendSelected = async () => {
    if (selectedIds.size === 0) return;
    const selected = items.filter(i => selectedIds.has(i.id));
    const platforms = Array.from(new Set(selected.map(i => i.platform)));
    if (!confirm(`${selectedIds.size}건을 ${platforms.join('+')} 개발방으로 전송할까요?`)) return;
    setSending(true);
    for (const p of platforms) {
      const ids = selected.filter(i => i.platform === p).map(i => i.id);
      if (ids.length > 0) {
        await fetch('/api/send/bug-items', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemIds: ids, platform: p }) });
      }
    }
    alert('전송 완료!'); setSelectedIds(new Set()); loadData(); setSending(false);
  };

  const handleSendUnsent = async () => {
    const unsent = items.filter(i => i.send_status === '미전송');
    if (unsent.length === 0) { alert('미전송 항목이 없습니다'); return; }
    if (!confirm(`미전송 ${unsent.length}건을 전체 전송할까요?`)) return;
    setSending(true);
    const platforms = Array.from(new Set(unsent.map(i => i.platform)));
    for (const p of platforms) {
      const ids = unsent.filter(i => i.platform === p).map(i => i.id);
      if (ids.length > 0) {
        await fetch('/api/send/bug-items', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemIds: ids, platform: p }) });
      }
    }
    alert('전송 완료!'); loadData(); setSending(false);
  };

  const columns = [
    { key: 'platform', label: '플랫폼', width: 'w-16', sortable: true, render: (i: BugItem) => (
      <span className={`text-xs font-medium ${i.platform === 'AOS' ? 'text-green-600' : 'text-blue-600'}`}>{i.platform}</span>
    )},
    { key: 'priority', label: '우선순위', width: 'w-20', sortable: true, render: (i: BugItem) => <PriorityTag priority={i.priority} /> },
    { key: 'location', label: '이슈 위치', sortable: true, render: (i: BugItem) => (
      <button onClick={() => setEditId(i.id)} className="text-blue-600 hover:underline font-medium text-left">{i.location}</button>
    )},
    { key: 'description', label: '상세설명', width: 'max-w-xs', render: (i: BugItem) => <span className="text-gray-500 text-xs line-clamp-2">{i.description || '-'}</span> },
    { key: 'reporter', label: '보고자', width: 'w-20' },
    { key: 'developer', label: '개발담당', width: 'w-20', render: (i: BugItem) => i.developers?.name || <span className="text-gray-300">미배정</span> },
    { key: 'fix_status', label: '수정결과', width: 'w-24', sortable: true, render: (i: BugItem) => <StatusBadge status={i.fix_status} type="fix" /> },
    { key: 'send_status', label: '전송', width: 'w-20', render: (i: BugItem) => <StatusBadge status={i.send_status} type="send" /> },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">앱 오류사항</h1>
        <div className="flex items-center gap-2">
          {['ALL','AOS','iOS'].map(p => (
            <button key={p} onClick={() => setPlatformFilter(p)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${platformFilter === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {p === 'ALL' ? '전체' : p}
            </button>
          ))}
          <button onClick={() => { setEditId(null); setShowForm(true); }}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors ml-2">
            <Plus size={16}/> 오류 추가
          </button>
        </div>
      </div>

      <DataTable data={filtered} columns={columns} selectable selectedIds={selectedIds} onSelectionChange={setSelectedIds}
        searchKeys={['location','description','reporter']} searchPlaceholder="위치, 설명, 보고자 검색..."
        emptyMessage={loading ? '로딩 중...' : '등록된 오류가 없습니다'}
        toolbar={
          <div className="flex items-center gap-2">
            <button onClick={handleSendSelected} disabled={selectedIds.size===0||sending}
              className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors">
              <Send size={13}/> 선택 전송 {selectedIds.size > 0 && `(${selectedIds.size})`}
            </button>
            <button onClick={handleSendUnsent} disabled={sending}
              className="flex items-center gap-1.5 bg-gray-700 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors">
              <SendHorizonal size={13}/> 미전송 전체 전송
            </button>
          </div>
        }
      />

      {(showForm || editId) && (
        <BugFormModal supabase={supabase} developers={developers} editId={editId}
          onClose={() => { setShowForm(false); setEditId(null); }}
          onSaved={() => { setShowForm(false); setEditId(null); loadData(); }} />
      )}
    </div>
  );
}

function BugFormModal({ supabase, developers, editId, onClose, onSaved }: {
  supabase: any; developers: Developer[]; editId: string | null;
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    platform: 'AOS' as 'AOS' | 'iOS' | 'COMMON',
    version: '', location: '', description: '',
    priority: '보통' as Priority, department: '', reporter: '',
    developer_id: '', fix_status: '미수정' as FixStatus, note: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editId) {
      supabase.from('bug_items').select('*').eq('id', editId).single().then(({ data }: any) => {
        if (data) setForm({
          platform: data.platform || 'AOS', version: data.version || '',
          location: data.location || '', description: data.description || '',
          priority: data.priority || '보통', department: data.department || '',
          reporter: data.reporter || '', developer_id: data.developer_id || '',
          fix_status: data.fix_status || '미수정', note: data.note || '',
        });
      });
    }
  }, [editId]);

  const handleSave = async () => {
    if (!form.location.trim()) { alert('이슈 위치를 입력하세요'); return; }
    setSaving(true);
    const payload = { ...form, developer_id: form.developer_id || null };
    if (editId) { await supabase.from('bug_items').update(payload).eq('id', editId); }
    else { await supabase.from('bug_items').insert(payload); }
    setSaving(false); onSaved();
  };

  const handleDelete = async () => {
    if (!editId || !confirm('이 오류를 삭제할까요?')) return;
    await supabase.from('bug_items').delete().eq('id', editId); onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{editId ? '오류 수정' : '새 오류 추가'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18}/></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">플랫폼 *</label>
              <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value as any }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                {['AOS','iOS'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <Field label="버전" value={form.version} onChange={v => setForm(f => ({ ...f, version: v }))} placeholder="V51.0.3" />
          </div>
          <Field label="이슈 위치 *" value={form.location} onChange={v => setForm(f => ({ ...f, location: v }))} placeholder="야구 결과 > 순위 두수 표시" />
          <Field label="상세설명" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} multiline placeholder="오류 상세 내용..." />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">우선순위</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                {['긴급','높음','보통','낮음'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <Field label="부서" value={form.department} onChange={v => setForm(f => ({ ...f, department: v }))} placeholder="운영" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="보고자" value={form.reporter} onChange={v => setForm(f => ({ ...f, reporter: v }))} placeholder="이민준" />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">개발담당자</label>
              <select value={form.developer_id} onChange={e => setForm(f => ({ ...f, developer_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">미배정</option>
                {developers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.platform})</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">수정결과</label>
            <select value={form.fix_status} onChange={e => setForm(f => ({ ...f, fix_status: e.target.value as FixStatus }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              {['미수정','수정중','수정완료','보류'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
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
