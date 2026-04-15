'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, createContext, useContext, useRef } from 'react';
import { LogOut, User, ChevronDown, Plus, Trash2, Moon, Sun, Pencil, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { AppVersion } from '@/lib/types/database';
import { useDark } from '@/components/layout/DashboardShell';

export const VersionContext = createContext<{
  aosVersion: string; iosVersion: string; serverVersion: string;
  setAosVersion: (v: string) => void; setIosVersion: (v: string) => void; setServerVersion: (v: string) => void;
  aosVersions: AppVersion[]; iosVersions: AppVersion[]; serverVersions: AppVersion[];
  refreshVersions: () => void; userName: string; userDept: string; userEmail: string;
}>({
  aosVersion: '', iosVersion: '', serverVersion: '',
  setAosVersion: () => {}, setIosVersion: () => {}, setServerVersion: () => {},
  aosVersions: [], iosVersions: [], serverVersions: [],
  refreshVersions: () => {}, userName: '', userDept: '', userEmail: '',
});

export function useVersion() { return useContext(VersionContext); }

export function stripVersionLabel(version: string): string {
  return version.replace(/\s*\(.*?\)\s*/g, '').trim();
}

function getVersionSuffix(version: string): string {
  const m = version.match(/\(([^)]+)\)/);
  return m ? m[1] : '';
}

// 완료 날짜 포맷: TIMESTAMPTZ → "yy.mm.dd"
function formatCompletedDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  // 한국 시간 기준
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const yy = String(kst.getUTCFullYear()).slice(2);
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}`;
}

export default function Header() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const ctx = useVersion();
  const { dark, toggle } = useDark();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: any }) => setUser(data.user));
  }, [supabase]);

  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = '/login'; };

  return (
    <header className="h-14 bg-white dark:bg-neutral-900 border-b-[3px] border-black dark:border-neutral-700 flex items-center justify-between px-6 flex-shrink-0 z-10">
      <div className="flex items-center gap-3">
        <VersionDropdown label="AOS" versions={ctx.aosVersions} selected={ctx.aosVersion} onSelect={ctx.setAosVersion} refresh={ctx.refreshVersions} />
        <VersionDropdown label="iOS" versions={ctx.iosVersions} selected={ctx.iosVersion} onSelect={ctx.setIosVersion} refresh={ctx.refreshVersions} />
        <VersionDropdown label="SERVER" versions={ctx.serverVersions} selected={ctx.serverVersion} onSelect={ctx.setServerVersion} refresh={ctx.refreshVersions} />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={toggle} className="p-2 rounded-md border-2 border-neutral-300 dark:border-neutral-600 hover:border-black dark:hover:border-white text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-all" title={dark ? '라이트 모드' : '다크 모드'}>
          {dark ? <Sun size={16} strokeWidth={2.5} /> : <Moon size={16} strokeWidth={2.5} />}
        </button>
        {user && (
          <div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 font-medium">
            <div className="w-8 h-8 bg-neutral-200 dark:bg-neutral-700 rounded-md border-2 border-black dark:border-neutral-500 flex items-center justify-center overflow-hidden">
              {user.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="" className="w-8 h-8 rounded-md" /> : <User size={14} strokeWidth={2.5} />}
            </div>
            <span className="hidden sm:inline">{user.user_metadata?.full_name || user.email}</span>
          </div>
        )}
        <button onClick={handleLogout} className="p-2 rounded-md border-2 border-neutral-300 dark:border-neutral-600 hover:border-red-500 text-neutral-400 hover:text-red-500 transition-all" title="로그아웃">
          <LogOut size={16} strokeWidth={2.5} />
        </button>
      </div>
    </header>
  );
}

const hoverBtnStyle = `
  .ver-row .ver-actions { visibility: hidden; }
  .ver-row:hover .ver-actions { visibility: visible; }
`;

function VersionDropdown({ label, versions, selected, onSelect, refresh }: {
  label: string; versions: AppVersion[]; selected: string; onSelect: (v: string) => void; refresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [newVer, setNewVer] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVer, setEditVer] = useState('');
  const savingRef = useRef(false);

  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const router = useRouter();
  const platform = label as 'AOS' | 'iOS' | 'SERVER';

  const handleEditSave = async (id: string, oldVersion: string) => {
    const trimmed = editVer.trim();
    if (!trimmed || trimmed === oldVersion) { setEditingId(null); return; }
    await supabase.from('app_versions').update({ version: trimmed }).eq('id', id);
    for (const t of ['dev_items', 'bug_items']) {
      await supabase.from(t).update({ version: trimmed }).eq('version', oldVersion).eq('platform', platform);
    }
    await supabase.from('common_bugs').update({ version: trimmed }).eq('version', oldVersion);
    await supabase.from('server_bugs').update({ version: trimmed }).eq('version', oldVersion);
    setEditingId(null);
    if (selected === oldVersion) onSelect(trimmed);
    refresh();
  };

  const handleAdd = async () => {
    if (!newVer.trim()) return;
    await supabase.from('app_versions').insert({ platform, version: newVer.trim(), is_current: false });
    setNewVer('');
    refresh();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('삭제?')) return;
    await supabase.from('app_versions').delete().eq('id', id);
    refresh();
  };

  // 완료 처리: is_current 토글 + completed_at 저장/삭제
  // 완료 ON → 버전명에서 (다음 업데이트) 등 suffix 제거 + selected 동기화
  const toggleComplete = async (e: React.MouseEvent, v: AppVersion) => {
    e.stopPropagation();
    const turningOn = !v.is_current;
    const pureName = stripVersionLabel(v.version);
    const updateData: any = {
      is_current: turningOn,
      // 완료 ON: 순수 버전명으로 정리 + 날짜 기록 / 완료 OFF: 날짜 삭제
      version: turningOn ? pureName : v.version,
      completed_at: turningOn ? new Date().toISOString() : null,
    };
    await supabase.from('app_versions').update(updateData).eq('id', v.id);
    // 완료 ON 시: 선택 버전이 이 버전이면 순수 버전명으로 동기화 (suffix 제거)
    if (turningOn && selected === v.version) onSelect(pureName);
    refresh();
  };

  const toggleNextUpdate = async (e: React.MouseEvent, v: AppVersion) => {
    e.stopPropagation();
    const hasSuffix = /\(.*?\)/.test(v.version);
    const pureName = stripVersionLabel(v.version);
    const newVersion = hasSuffix ? pureName : `${pureName} (다음 업데이트)`;
    await supabase.from('app_versions').update({ version: newVersion }).eq('id', v.id);
    refresh();
  };

  // 헤더 버튼: 선택 버전의 전체 AppVersion 객체 찾기
  const selectedVerObj = versions.find(v =>
    v.version === selected || stripVersionLabel(v.version) === stripVersionLabel(selected)
  );
  const selectedLabel = stripVersionLabel(selected);
  const completedDate = selectedVerObj?.is_current
    ? formatCompletedDate((selectedVerObj as any).completed_at)
    : null;
  const selectedSuffix = getVersionSuffix(selected);
  const selectedIsNext = !!selectedSuffix && !selectedVerObj?.is_current;

  return (
    <div className="relative">
      <style>{hoverBtnStyle}</style>
      <div className="flex items-center border-2 border-black dark:border-neutral-600 bg-white dark:bg-neutral-800 rounded-md overflow-hidden">
        <button
          onClick={() => { setOpen(!open); setEditingId(null); }}
          className="flex items-center gap-2 text-xs text-black dark:text-white px-3 py-1.5 font-bold hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all whitespace-nowrap"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-black dark:bg-white shrink-0" />
          {label} {selectedLabel || '미설정'}
          {/* 완료된 버전: 업데이트 완료 날짜 뱃지 */}
          {completedDate && (
            <span style={{ fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '3px', border: '1.5px solid #6b7280', color: '#6b7280', backgroundColor: 'rgba(107,114,128,0.1)', whiteSpace: 'nowrap' }}>
              업데이트 완료: {completedDate}
            </span>
          )}
          {/* 다음 업데이트 버전 (완료 아닐 때만) */}
          {selectedIsNext && (
            <span style={{ fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '3px', border: '1.5px solid #f97316', color: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)', whiteSpace: 'nowrap' }}>
              {selectedSuffix}
            </span>
          )}
          <ChevronDown size={12} strokeWidth={3} className={`transition shrink-0 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => { setOpen(false); setEditingId(null); }} />
          <div className="absolute top-full left-0 mt-2 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-600 rounded-lg shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,0.1)] z-30 min-w-[420px] overflow-hidden">
            <div className="px-4 py-2 text-[10px] font-black text-neutral-500 uppercase tracking-widest border-b-2 border-black dark:border-neutral-700">{label} 버전</div>
            <div className="max-h-60 overflow-y-auto">
              {versions.map(v => {
                const pureVersion = stripVersionLabel(v.version);
                const suffix = getVersionSuffix(v.version);
                const isNextUpdate = !!suffix && !v.is_current;
                // 선택 비교: 순수 버전명으로 (suffix 제거 후 비교)
                const isSelected = stripVersionLabel(v.version) === stripVersionLabel(selected) || v.version === selected;
                const isEditing = editingId === v.id;
                const completedDateStr = v.is_current ? formatCompletedDate((v as any).completed_at) : null;

                return (
                  <div
                    key={v.id}
                    onClick={() => {
                      if (isEditing) return;
                      onSelect(v.version);
                      setOpen(false);
                      setEditingId(null);
                      router.push(label === 'AOS' ? '/dev/aos' : label === 'iOS' ? '/dev/ios' : '/dev/server');
                    }}
                    style={isEditing ? { backgroundColor: '#f5f5f5' } : undefined}
                    className={`ver-row flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer transition-all border-b border-neutral-100 dark:border-neutral-800 ${
                      isEditing ? '' : isSelected
                        ? 'bg-black text-white dark:bg-white dark:text-black'
                        : 'hover:bg-neutral-100 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {/* 왼쪽: 버전명 + 뱃지 */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editVer}
                          onChange={e => setEditVer(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { savingRef.current = true; handleEditSave(v.id, v.version); }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          onBlur={() => {
                            if (savingRef.current) { savingRef.current = false; return; }
                            setEditingId(null);
                          }}
                          autoFocus
                          onClick={e => e.stopPropagation()}
                          style={{ backgroundColor: '#ffffff', color: '#111111', border: '2px solid #3b82f6', borderRadius: '4px', padding: '2px 8px', fontSize: '14px', fontWeight: 'bold', outline: 'none', width: '160px' }}
                        />
                      ) : (
                        <span className={`font-bold whitespace-nowrap ${isSelected ? '' : 'text-neutral-700 dark:text-neutral-200'}`}>
                          {pureVersion}
                        </span>
                      )}
                      {/* 다음 업데이트 뱃지 (완료 아닐 때만) */}
                      {isNextUpdate && !isEditing && (
                        <span style={isSelected
                          ? { fontSize: '10px', fontWeight: 900, padding: '1px 6px', borderRadius: '3px', border: '2px solid #fb923c', color: '#fb923c', backgroundColor: 'rgba(251,146,60,0.15)', whiteSpace: 'nowrap' }
                          : { fontSize: '10px', fontWeight: 900, padding: '1px 6px', borderRadius: '3px', border: '2px solid #f97316', color: '#f97316', backgroundColor: 'rgba(249,115,22,0.08)', whiteSpace: 'nowrap' }
                        }>{suffix}</span>
                      )}
                      {/* 완료 뱃지 + 날짜 */}
                      {v.is_current && !isEditing && (
                        <span style={isSelected
                          ? { fontSize: '10px', fontWeight: 900, padding: '1px 6px', borderRadius: '3px', border: '2px solid #f87171', color: '#f87171', backgroundColor: 'rgba(248,113,113,0.15)', whiteSpace: 'nowrap' }
                          : { fontSize: '10px', fontWeight: 900, padding: '1px 6px', borderRadius: '3px', border: '2px solid #ef4444', color: '#dc2626', backgroundColor: 'rgba(239,68,68,0.08)', whiteSpace: 'nowrap' }
                        }>
                          완료{completedDateStr ? ` ${completedDateStr}` : ''}
                        </span>
                      )}
                    </div>

                    {/* 오른쪽: 액션 버튼 */}
                    <div
                      className="ver-actions flex items-center gap-1 shrink-0"
                      style={isEditing ? { visibility: 'visible' } : undefined}
                      onClick={e => e.stopPropagation()}
                    >
                      {isEditing ? (
                        <button
                          onMouseDown={() => { savingRef.current = true; }}
                          onClick={() => handleEditSave(v.id, v.version)}
                          style={{ backgroundColor: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Check size={11} strokeWidth={3} />
                          수정완료
                        </button>
                      ) : (
                        <>
                          {!v.is_current && (
                            <button
                              onClick={e => toggleNextUpdate(e, v)}
                              style={isNextUpdate
                                ? { border: '2px solid #f97316', color: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }
                                : isSelected
                                  ? { border: '2px solid #666', color: '#444', backgroundColor: 'transparent', borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }
                                  : { border: '2px solid #999', color: '#555', backgroundColor: 'transparent', borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }
                              }
                            >▶ 다음</button>
                          )}
                          <button
                            onClick={e => toggleComplete(e, v)}
                            style={isSelected
                              ? { border: '2px solid #666', color: '#444', backgroundColor: 'transparent', borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }
                              : { border: '2px solid #999', color: '#555', backgroundColor: 'transparent', borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }
                            }
                          >{v.is_current ? '해제' : '완료'}</button>
                          <button
                            onClick={e => { e.stopPropagation(); setEditingId(v.id); setEditVer(v.version); }}
                            style={{ color: isSelected ? '#555' : '#999', padding: '2px', cursor: 'pointer', background: 'none', border: 'none' }}
                          ><Pencil size={13} strokeWidth={2.5} /></button>
                          <button
                            onClick={e => handleDelete(e, v.id)}
                            style={{ color: isSelected ? '#555' : '#999', padding: '2px', cursor: 'pointer', background: 'none', border: 'none' }}
                          ><Trash2 size={13} strokeWidth={2.5} /></button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {versions.length === 0 && <div className="px-4 py-3 text-xs text-neutral-400 text-center font-medium">버전 없음</div>}
            <div className="border-t-2 border-black dark:border-neutral-700 px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <input type="text" value={newVer} onChange={e => setNewVer(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="새 버전 (예: V52.0.0)" className="flex-1 text-xs border-2 border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-black dark:text-white rounded-md px-2.5 py-1.5 font-medium focus:border-black dark:focus:border-white focus:outline-none" />
                <button onClick={handleAdd} disabled={!newVer.trim()} className="p-1.5 bg-black dark:bg-white text-white dark:text-black rounded-md border-2 border-black dark:border-white hover:shadow-[2px_2px_0_0_rgba(0,0,0,0.5)] disabled:opacity-30 font-bold"><Plus size={14} strokeWidth={3} /></button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
