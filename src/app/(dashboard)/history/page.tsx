'use client';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Search, Plus, X, Tag, Clock, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';

const CATEGORIES = ['코드변경', 'DB변경', '팀원/설정', '배포', '기타'] as const;
type Category = typeof CATEGORIES[number];

const CAT_COLORS: Record<Category, string> = {
  '코드변경': 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-600',
  'DB변경': 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-600',
  '팀원/설정': 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-600',
  '배포': 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-600',
  '기타': 'bg-neutral-100 text-neutral-600 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-600',
};

interface HistoryLog {
  id: string;
  title: string;
  content: string;
  category: Category;
  tags: string[];
  created_at: string;
  created_by: string;
}

// Simple Korean-aware similarity search
function similarityScore(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 1;
  if (t.includes(q)) return 10; // exact substring match

  const words = q.split(/\s+/);
  let score = 0;
  for (const w of words) {
    if (t.includes(w)) score += 3;
    // partial match (2+ chars)
    else if (w.length >= 2) {
      for (let i = 0; i <= w.length - 2; i++) {
        if (t.includes(w.slice(i, i + 2))) { score += 1; break; }
      }
    }
  }
  return score;
}

export default function HistoryPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<HistoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<Category | ''>('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({ title: '', content: '', category: '코드변경' as Category, tags: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('history_logs')
      .select('*')
      .order('created_at', { ascending: false });
    setLogs((data as HistoryLog[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = logs
    .filter(log => !catFilter || log.category === catFilter)
    .map(log => ({
      ...log,
      _score: similarityScore(
        `${log.title} ${log.content} ${(log.tags || []).join(' ')} ${log.category}`,
        search
      ),
    }))
    .filter(log => !search || log._score > 0)
    .sort((a, b) => search ? b._score - a._score : 0);

  const openNew = () => {
    setForm({ title: '', content: '', category: '코드변경', tags: '' });
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (log: HistoryLog) => {
    setForm({
      title: log.title,
      content: log.content,
      category: log.category,
      tags: (log.tags || []).join(', '),
    });
    setEditId(log.id);
    setShowForm(true);
  };

  const save = async () => {
    if (!form.title.trim()) { alert('제목을 입력하세요'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      category: form.category,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      created_by: user?.email || '',
    };

    if (editId) {
      await supabase.from('history_logs').update(payload).eq('id', editId);
    } else {
      await supabase.from('history_logs').insert(payload);
    }
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('삭제할까요?')) return;
    await supabase.from('history_logs').delete().eq('id', id);
    load();
  };

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,'0')}.${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen size={22} /> 히스토리북
          </h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">프로젝트 변경 이력 관리</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1 bg-black text-white dark:bg-white dark:text-black text-xs font-bold px-4 py-2 rounded-md border-2 border-black dark:border-white hover:shadow-[2px_2px_0_0_rgba(0,0,0,0.5)] transition-all">
          <Plus size={14} /> 기록 추가
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} strokeWidth={2.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="키워드로 검색 (유사도 기반)..."
            className="w-full pl-9 pr-3 py-2 text-sm border-2 border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-black dark:text-white rounded-md font-medium focus:border-black dark:focus:border-white focus:outline-none"
          />
        </div>
        <div className="flex gap-1">
          <button onClick={() => setCatFilter('')}
            className={`text-xs font-bold px-3 py-1.5 rounded-md border-2 transition-all ${!catFilter ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white' : 'bg-white dark:bg-neutral-800 text-neutral-500 border-neutral-300 dark:border-neutral-600 hover:border-black dark:hover:border-white'}`}>
            전체
          </button>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCatFilter(catFilter === cat ? '' : cat)}
              className={`text-xs font-bold px-3 py-1.5 rounded-md border-2 transition-all ${catFilter === cat ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white' : 'bg-white dark:bg-neutral-800 text-neutral-500 border-neutral-300 dark:border-neutral-600 hover:border-black dark:hover:border-white'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-12 text-neutral-400">로딩 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-neutral-400 font-medium">
            {search ? '검색 결과가 없습니다' : '등록된 히스토리가 없습니다'}
          </div>
        ) : filtered.map(log => (
          <div key={log.id} className="bg-white dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden hover:border-black dark:hover:border-neutral-500 transition-all">
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${CAT_COLORS[log.category]}`}>
                {log.category}
              </span>
              <span className="font-bold text-sm text-neutral-900 dark:text-white flex-1">{log.title}</span>
              {search && log._score > 0 && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
                  매칭 {log._score}
                </span>
              )}
              <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                <Clock size={10} /> {formatDate(log.created_at)}
              </span>
              {expandedId === log.id ? <ChevronUp size={14} className="text-neutral-400" /> : <ChevronDown size={14} className="text-neutral-400" />}
            </div>

            {expandedId === log.id && (
              <div className="px-4 pb-4 border-t border-neutral-100 dark:border-neutral-800">
                <div className="mt-3 text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
                  {log.content}
                </div>
                {log.tags && log.tags.length > 0 && (
                  <div className="mt-3 flex items-center gap-1 flex-wrap">
                    <Tag size={12} className="text-neutral-400" />
                    {log.tags.map((tag, i) => (
                      <span key={i} className="text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-2 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] text-neutral-400">작성자: {log.created_by}</span>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(log)} className="text-xs font-bold text-blue-600 hover:underline">수정</button>
                    <button onClick={() => handleDelete(log.id)} className="text-xs font-bold text-red-500 hover:underline">삭제</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-xs text-neutral-400 font-bold">총 {filtered.length}건{logs.length !== filtered.length && ` (전체 ${logs.length}건)`}</div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-neutral-900 rounded-lg border-2 border-black dark:border-neutral-600 shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:shadow-[6px_6px_0_0_rgba(255,255,255,0.05)] w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="font-bold text-lg text-neutral-900 dark:text-white">{editId ? '히스토리 수정' : '히스토리 추가'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">카테고리</label>
                <div className="flex gap-1 flex-wrap">
                  {CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => setForm(p => ({ ...p, category: cat }))}
                      className={`text-xs font-bold px-3 py-1.5 rounded-md border-2 transition-all ${form.category === cat ? 'bg-black text-white border-black dark:bg-white dark:text-black' : 'bg-white dark:bg-neutral-800 text-neutral-500 border-neutral-300 dark:border-neutral-600'}`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">제목 *</label>
                <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="예: 검수결과 6개 카테고리 추가"
                  className="w-full border-2 border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-black dark:text-white rounded-lg px-3 py-2 text-sm font-medium focus:border-black dark:focus:border-white focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">상세 내용</label>
                <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  placeholder="변경 내용을 자세히 기록하세요..."
                  rows={6}
                  className="w-full border-2 border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-black dark:text-white rounded-lg px-3 py-2 text-sm font-medium focus:border-black dark:focus:border-white focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">태그 (쉼표로 구분)</label>
                <input type="text" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                  placeholder="예: 검수결과, QA, 크로스체크"
                  className="w-full border-2 border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-black dark:text-white rounded-lg px-3 py-2 text-sm font-medium focus:border-black dark:focus:border-white focus:outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-neutral-400 rounded-lg font-medium">취소</button>
              <button onClick={save} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">{editId ? '수정' : '저장'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
