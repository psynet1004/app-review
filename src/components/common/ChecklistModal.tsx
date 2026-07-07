'use client';
import { useEffect, useState, useCallback } from 'react';
import { X, Plus, Trash2, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// ── 타입 ──────────────────────────────────────────────────────
export interface ChecklistItem {
  id?: string;          // DB에 저장된 항목은 uuid
  template_id?: string;
  category: string;
  sub_category?: string | null;
  label: string;
  is_checked: boolean;
  checked_by?: string;
  checked_at?: string;
  sort_order: number;
  isNew?: boolean;      // 신규 추가(미저장) 항목
}

interface Props {
  /** 'edit' : 개발항목 추가/수정 시 체크리스트 편집
   *  'confirm' : 검수완료 클릭 시 최종 확인  */
  mode: 'edit' | 'confirm';
  devItemId?: string;     // 기존 항목 수정 or 검수완료 시
  isPM: boolean;          // PM 여부 (항목 추가/삭제 권한)
  userEmail: string;
  onClose: () => void;
  /** confirm 모드에서 전체 체크 완료 후 호출 */
  onConfirm?: () => void;
  /** edit 모드에서 저장된 체크리스트를 부모에게 전달 (신규 항목 추가 시) */
  onSaveItems?: (items: ChecklistItem[]) => void;
}

const CATEGORY_COLOR: Record<string, string> = {
  'PM':   'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  '서버': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  '모바일':'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
};

// ── 헬퍼 ──────────────────────────────────────────────────────
function groupByCategory(items: ChecklistItem[]) {
  const map = new Map<string, { sub: Map<string, ChecklistItem[]> }>();
  for (const item of items) {
    if (!map.has(item.category)) map.set(item.category, { sub: new Map() });
    const subKey = item.sub_category || '__none__';
    const cat = map.get(item.category)!;
    if (!cat.sub.has(subKey)) cat.sub.set(subKey, []);
    cat.sub.get(subKey)!.push(item);
  }
  return map;
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function ChecklistModal({ mode, devItemId, isPM, userEmail, onClose, onConfirm, onSaveItems }: Props) {
  const supabase = createClient();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newCategory, setNewCategory] = useState<'PM'|'서버'|'모바일'>('PM');
  const [newSubCategory, setNewSubCategory] = useState('');
  const [showAddRow, setShowAddRow] = useState(false);

  // ── 데이터 로드 ────────────────────────────────────────────
  const loadItems = useCallback(async () => {
    setLoading(true);
    if (devItemId) {
      // 기존 항목 — DB에서 불러오기
      const { data } = await supabase
        .from('dev_item_checklists')
        .select('*')
        .eq('dev_item_id', devItemId)
        .order('sort_order');
      setItems((data || []) as ChecklistItem[]);
    } else {
      // 신규 항목 — 기본 템플릿 불러오기
      const { data } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      setItems((data || []).map((t: any) => ({
        template_id: t.id,
        category: t.category,
        sub_category: t.sub_category,
        label: t.label,
        is_checked: false,
        sort_order: t.sort_order,
        isNew: true,
      })));
    }
    setLoading(false);
  }, [devItemId, supabase]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // ── 체크 토글 (confirm 모드) ───────────────────────────────
  const toggleCheck = async (idx: number) => {
    const item = items[idx];
    const next = !item.is_checked;
    const updated = items.map((it, i) =>
      i === idx ? { ...it, is_checked: next, checked_by: next ? userEmail : undefined, checked_at: next ? new Date().toISOString() : undefined } : it
    );
    setItems(updated);

    // DB 항목이면 즉시 저장
    if (item.id) {
      await supabase.from('dev_item_checklists').update({
        is_checked: next,
        checked_by: next ? userEmail : null,
        checked_at: next ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id);
    }
  };

  // ── 항목 삭제 (PM, edit 모드) ──────────────────────────────
  const deleteItem = async (idx: number) => {
    const item = items[idx];
    if (item.id) {
      await supabase.from('dev_item_checklists').delete().eq('id', item.id);
    }
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // ── 항목 추가 (PM, edit 모드) ──────────────────────────────
  const addItem = () => {
    if (!newLabel.trim()) return;
    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 10 : 10;
    setItems(prev => [...prev, {
      category: newCategory,
      sub_category: newSubCategory || null,
      label: newLabel.trim(),
      is_checked: false,
      sort_order: maxOrder,
      isNew: true,
    }]);
    setNewLabel('');
    setNewSubCategory('');
    setShowAddRow(false);
  };

  // ── edit 모드 저장 ─────────────────────────────────────────
  const saveEdit = async () => {
    setSaving(true);
    if (devItemId) {
      // 기존 항목: 신규 추가된 것만 INSERT (삭제는 이미 처리됨)
      const newOnes = items.filter(i => i.isNew);
      for (const it of newOnes) {
        await supabase.from('dev_item_checklists').insert({
          dev_item_id: devItemId,
          template_id: it.template_id || null,
          category: it.category,
          sub_category: it.sub_category || null,
          label: it.label,
          is_checked: false,
          sort_order: it.sort_order,
        });
      }
      setItems(prev => prev.map(i => ({ ...i, isNew: false })));
    } else {
      // 신규 항목: 부모에게 전달 (devItemId 확정 후 부모가 INSERT)
      onSaveItems?.(items);
    }
    setSaving(false);
    onClose();
  };

  // ── confirm 모드: 전체 체크 확인 후 검수완료 확정 ──────────
  const allChecked = items.length > 0 && items.every(i => i.is_checked);

  const handleConfirm = async () => {
    if (!allChecked) return;
    setSaving(true);
    onConfirm?.();
    setSaving(false);
    onClose();
  };

  // ── 렌더 ──────────────────────────────────────────────────
  const grouped = groupByCategory(items);
  const total = items.length;
  const checked = items.filter(i => i.is_checked).length;

  return (
    <div className={`fixed inset-0 z-[60] flex items-center justify-center ${mode === 'edit' ? '' : 'bg-black/60'}`} onClick={onClose}>
      <div className={`relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden ${mode === 'edit' ? 'translate-x-[528px]' : ''}`}
        onClick={e => e.stopPropagation()}>

        {/* ── 헤더 ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-500" />
            <h2 className="text-base font-bold text-neutral-900 dark:text-white">
              {mode === 'confirm' ? '검수완료 최종 확인' : '체크리스트 편집'}
            </h2>
            {total > 0 && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${allChecked ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                {checked}/{total}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── 경고 배너 (항상 상단 고정) ── */}
        <div className="shrink-0 mx-4 mt-4 rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600 px-4 py-3 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-amber-800 dark:text-amber-300">⚠️ 상용 서비스 오류를 줄이기 위한 최종 확인입니다.</p>
            <p className="text-amber-700 dark:text-amber-400 mt-0.5">각 항목은 실제 배포 품질에 직접 영향을 줍니다.</p>
            <p className="text-amber-700 dark:text-amber-400">체크는 곧 &quot;확인했고 책임진다&quot;는 의미입니다. 형식적으로 넘기지 마세요.</p>
          </div>
        </div>

        {/* ── 체크리스트 본문 ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {loading ? (
            <div className="text-center py-10 text-neutral-400 text-sm">불러오는 중...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-10 text-neutral-400 text-sm">체크리스트 항목이 없습니다.</div>
          ) : (
            Array.from(grouped.entries()).map(([category, { sub }]) => (
              <div key={category}>
                {/* 카테고리 헤더 */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3 ${CATEGORY_COLOR[category] || 'bg-neutral-100 text-neutral-600'}`}>
                  {category}
                </div>
                <div className="space-y-3">
                  {Array.from(sub.entries()).map(([subKey, subItems]) => (
                    <div key={subKey} className="space-y-1.5">
                      {subKey !== '__none__' && (
                        <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 pl-1 mt-2">{subKey}</p>
                      )}
                      {subItems.map((item, _) => {
                        const globalIdx = items.indexOf(item);
                        return (
                          <div key={globalIdx} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-colors ${item.is_checked ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'}`}>
                            <input
                              type="checkbox"
                              checked={item.is_checked}
                              onChange={() => toggleCheck(globalIdx)}
                              className="w-4 h-4 mt-0.5 accent-green-500 shrink-0 cursor-pointer"
                            />
                            <span className={`flex-1 text-sm ${item.is_checked ? 'text-green-700 dark:text-green-300 line-through' : 'text-neutral-800 dark:text-neutral-200'}`}>
                              {item.label}
                            </span>
                            {/* PM이고 edit 모드면 삭제 버튼 */}
                            {mode === 'edit' && isPM && (
                              <button onClick={() => deleteItem(globalIdx)}
                                className="p-1 rounded text-neutral-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {/* 권한 없는 edit 모드 자물쇠 */}
                            {mode === 'edit' && !isPM && (
                              <Lock className="w-3 h-3 text-neutral-300 shrink-0 mt-0.5" />
                            )}
                            {/* 체크한 사람 표시 */}
                            {mode === 'confirm' && item.is_checked && item.checked_by && (
                              <span className="text-xs text-green-600 dark:text-green-400 shrink-0 self-center">{item.checked_by.split('@')[0]}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          {/* PM 전용 항목 추가 (edit 모드) */}
          {mode === 'edit' && isPM && (
            <div className="mt-4">
              {showAddRow ? (
                <div className="border border-dashed border-blue-300 dark:border-blue-700 rounded-xl p-4 space-y-3 bg-blue-50/50 dark:bg-blue-900/10">
                  <div className="flex gap-2">
                    <select value={newCategory} onChange={e => setNewCategory(e.target.value as any)}
                      className="text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1.5 bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500">
                      <option value="PM">PM</option>
                      <option value="서버">서버</option>
                      <option value="모바일">모바일</option>
                    </select>
                    <input value={newSubCategory} onChange={e => setNewSubCategory(e.target.value)}
                      placeholder="소분류 (선택)"
                      className="text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 flex-1 bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addItem()}
                    placeholder="체크리스트 항목 입력 (Enter로 추가)"
                    className="w-full text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setShowAddRow(false); setNewLabel(''); setNewSubCategory(''); }}
                      className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                      취소
                    </button>
                    <button onClick={addItem} disabled={!newLabel.trim()}
                      className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                      추가
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddRow(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600 text-sm text-neutral-500 hover:border-blue-400 hover:text-blue-500 transition-colors">
                  <Plus className="w-4 h-4" />
                  이 항목에만 적용할 체크리스트 추가
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── 푸터 ── */}
        <div className="shrink-0 px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between gap-3">
          {mode === 'confirm' && (
            <p className={`text-xs font-medium ${allChecked ? 'text-green-600 dark:text-green-400' : 'text-neutral-400'}`}>
              {allChecked ? '✅ 모든 항목 확인 완료 — 검수완료 확정 가능' : `아직 ${total - checked}개 항목이 미체크 상태입니다`}
            </p>
          )}
          {mode === 'edit' && <span className="text-xs text-neutral-400">총 {total}개 항목</span>}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              {mode === 'edit' ? '취소' : '닫기'}
            </button>
            {mode === 'edit' && (
              <button onClick={saveEdit} disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? '저장 중...' : '저장'}
              </button>
            )}
            {mode === 'confirm' && (
              <button onClick={handleConfirm} disabled={!allChecked || saving}
                className={`px-4 py-2 text-sm rounded-lg font-bold transition-colors ${allChecked ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400 cursor-not-allowed'}`}>
                {saving ? '처리 중...' : '검수완료 확정'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
