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

// 버전명에서 순수 버전 번호만 추출 (예: "V51.0.7 (업데이트)" → "V51.0.7")
export function stripVersionLabel(version: string): string {
  return version.replace(/\s*\(.*?\)\s*/g, '').trim();
}

// 버전명에 부가 문구가 있는지 확인
function getVersionSuffix(version: string): string {
  const match = version.match(/\(([^)]+)\)/);
  return match ? match[1] : '';
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
              {user.user_metadata?.avatar_url
                ? <img src={user.user_metadata.avatar_url} alt="" className="w-8 h-8 rounded-md" />
                : <User size={14} strokeWidth={2.5} />}
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

function VersionDropdown({ label, versions, selected, onSelect, refresh }: {
  label: string;
  versions: AppVersion[];
  selected: string;
  onSelect: (v: string) => void;
  refresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [newVer, setNewVer] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVer, setEditVer] = useState('');
  // onBlur 방지용: 수정완료 버튼 클릭 중 여부
  const savingRef = useRef(false);

  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const router = useRouter();
  const platform = label as 'AOS' | 'iOS' | 'SERVER';

  // 수정완료 저장
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

  const toggleComplete = async (e: React.MouseEvent, v: AppVersion) => {
    e.stopPropagation();
    await supabase.from('app_versions').update({ is_current: !v.is_current }).eq('id', v.id);
    refresh();
  };

  // 버전명 헤더 버튼 표시: 순수 버전 번호만 (부가 문구 제거)
  const selectedLabel = stripVersionLabel(selected);

  return (
    <div className="relative">
      {/* 헤더 버튼: 부가 문구 없이 순수 버전명만, whitespace-nowrap으로 줄바꿈 방지 */}
      <div className="flex items-center border-2 border-black dark:border-neutral-600 bg-white dark:bg-neutral-800 rounded-md overflow-hidden">
        <button
          onClick={() => { setOpen(!open); setEditingId(null); }}
          className="flex items-center gap-2 text-xs text-black dark:text-white px-3 py-1.5 font-bold hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all whitespace-nowrap"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-black dark:bg-white shrink-0" />
          {label} {selectedLabel || '미설정'}
          <ChevronDown size={12} strokeWidth={3} className={`transition shrink-0 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => { setOpen(false); setEditingId(null); }} />
          <div className="absolute top-full left-0 mt-2 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-600 rounded-lg shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,0.1)] z-30 min-w-[320px] overflow-hidden">
            <div className="px-4 py-2 text-[10px] font-black text-neutral-500 uppercase tracking-widest border-b-2 border-black dark:border-neutral-700">{label} 버전</div>
            <div className="max-h-60 overflow-y-auto">
              {versions.map(v => {
                const pureVersion = stripVersionLabel(v.version);
                const suffix = getVersionSuffix(v.version);
                const isNextUpdate = !!suffix && !v.is_current;
                const isSelected = v.version === selected;

                return (
                  <div
                    key={v.id}
                    onClick={() => {
                      if (editingId === v.id) return;
                      onSelect(v.version);
                      setOpen(false);
                      setEditingId(null);
                      router.push(label === 'AOS' ? '/dev/aos' : label === 'iOS' ? '/dev/ios' : '/dev/server');
                    }}
                    className={`flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer group transition-all border-b border-neutral-100 dark:border-neutral-800 ${isSelected ? 'bg-black text-white dark:bg-white dark:text-black' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
                  >
                    {/* 왼쪽: 버전명 + 뱃지 */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                      {editingId === v.id ? (
                        <input
                          type="text"
                          value={editVer}
                          onChange={e => setEditVer(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { savingRef.current = true; handleEditSave(v.id, v.version); }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          onBlur={() => {
                            // 수정완료 버튼 클릭 중이면 blur 무시
                            if (savingRef.current) { savingRef.current = false; return; }
                            setEditingId(null);
                          }}
                          autoFocus
                          onClick={e => e.stopPropagation()}
                          className="font-bold text-sm bg-transparent border-b-2 border-blue-500 outline-none w-28 px-0 py-0 text-black dark:text-white"
                        />
                      ) : (
                        <span className={`font-bold whitespace-nowrap ${isSelected ? '' : 'text-neutral-700 dark:text-neutral-300'}`}>
                          {/* 드롭다운 리스트: 순수 버전명 표시 */}
                          {pureVersion}
                        </span>
                      )}

                      {/* 다음 업데이트 뱃지: 버전명에 괄호 문구가 있고 완료 처리 안 된 경우 */}
                      {isNextUpdate && editingId !== v.id && (
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border-2 whitespace-nowrap shrink-0 ${
                          isSelected
                            ? 'border-orange-300 text-orange-200 bg-orange-900/30'
                            : 'border-orange-400 text-orange-500 bg-orange-50 dark:bg-orange-900/30'
                        }`}>
                          {suffix}
                        </span>
                      )}

                      {/* 완료 뱃지 */}
                      {v.is_current && editingId !== v.id && (
                        <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border-2 font-black shrink-0 ${
                          isSelected
                            ? 'border-red-300 text-red-200 bg-red-900/30'
                            : 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        }`}>완료</span>
                      )}
                    </div>

                    {/* 오른쪽: 액션 버튼 */}
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      {editingId === v.id ? (
                        /* 수정 모드: 수정완료 버튼만 표시 — 완료 버튼과 완전 분리 */
                        <button
                          onMouseDown={() => { savingRef.current = true; }}
                          onClick={() => handleEditSave(v.id, v.version)}
                          className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded bg-blue-500 hover:bg-blue-600 text-white font-bold transition-colors"
                        >
                          <Check size={11} strokeWidth={3} />
                          수정완료
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          {/* 버전 전체 완료 처리 버튼 */}
                          <button
                            onClick={e => toggleComplete(e, v)}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-neutral-300 dark:border-neutral-600 font-bold text-neutral-600 dark:text-neutral-300 hover:border-red-400 hover:text-red-500 transition-colors"
                          >
                            {v.is_current ? '해제' : '완료'}
                          </button>
                          {/* 버전명 수정 버튼 */}
                          <button
                            onClick={e => { e.stopPropagation(); setEditingId(v.id); setEditVer(v.version); }}
                            className="text-neutral-400 hover:text-blue-500 transition-colors"
                          >
                            <Pencil size={13} strokeWidth={2.5} />
                          </button>
                          {/* 삭제 버튼 */}
                          <button onClick={e => handleDelete(e, v.id)} className="text-neutral-400 hover:text-red-500 transition-colors">
                            <Trash2 size={13} strokeWidth={2.5} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {versions.length === 0 && <div className="px-4 py-3 text-xs text-neutral-400 text-center font-medium">버전 없음</div>}
            <div className="border-t-2 border-black dark:border-neutral-700 px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newVer}
                  onChange={e => setNewVer(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  placeholder="새 버전 (예: V52.0.0)"
                  className="flex-1 text-xs border-2 border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-black dark:text-white rounded-md px-2.5 py-1.5 font-medium focus:border-black dark:focus:border-white focus:outline-none"
                />
                <button
                  onClick={handleAdd}
                  disabled={!newVer.trim()}
                  className="p-1.5 bg-black dark:bg-white text-white dark:text-black rounded-md border-2 border-black dark:border-white hover:shadow-[2px_2px_0_0_rgba(0,0,0,0.5)] disabled:opacity-30 font-bold"
                >
                  <Plus size={14} strokeWidth={3} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
