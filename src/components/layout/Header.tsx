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

  const toggleComplete = async (e: React.MouseEvent, v: AppVersion) => {
    e.stopPropagation();
    await supabase.from('app_versions').update({ is_current: !v.is_current }).eq('id', v.id);
    refresh();
  };

  const toggleNextUpdate = async (e: React.MouseEvent, v: AppVersion) => {
    e.stopPropagation();
    const hasSuffix = /\(.*?\)/.test(v.version);
    const pureName = stripVersionLabel(v.version);
    const newVersion = hasSuffix ? pureName : `${pureName} (다음 업데이트)`;
    await supabase.from('app_versions').update({ version: newVersion }).eq('id', v.id);
    for (const t of ['dev_items', 'bug_items']) {
      await supabase.from(t).update({ version: newVersion }).eq('version', v.version).eq('platform', platform);
    }
    await supabase.from('common_bugs').update({ version: newVersion }).eq('version', v.version);
    await supabase.from('server_bugs').update({ version: newVersion }).eq('version', v.version);
    if (selected === v.version) onSelect(newVersion);
    refresh();
  };

  const selectedLabel = stripVersionLabel(selected);

  return (
    <div className="relative">
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
          <div className="absolute top-full left-0 mt-2 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-600 rounded-lg shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,0.1)] z-30 min-w-[420px] overflow-hidden">
            <div className="px-4 py-2 text-[10px] font-black text-neutral-500 uppercase tracking-widest border-b-2 border-black dark:border-neutral-700">{label} 버전</div>
            <div className="max-h-60 overflow-y-auto">
              {versions.map(v => {
                const pureVersion = stripVersionLabel(v.version);
                const suffix = getVersionSuffix(v.version);
                const isNextUpdate = !!suffix && !v.is_current;
                const isSelected = v.version === selected;
                const isEditing = editingId === v.id;

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
                    // 수정 중일 때는 중립 배경, 선택된 행은 반전, 나머지는 hover
                    style={isEditing ? { backgroundColor: '#f5f5f5' } : undefined}
                    className={`flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer transition-all border-b border-neutral-100 dark:border-neutral-800 ${
                      isEditing
                        ? ''
                        : isSelected
                          ? 'bg-black text-white dark:bg-white dark:text-black'
                          : 'hover:bg-neutral-100 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {/* 왼쪽: 버전명 or 수정 input + 뱃지 */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                      {isEditing ? (
                        // 수정 input: inline style 강제 고정으로 라이트/다크 무관하게 항상 보임
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
                          style={{
                            backgroundColor: '#ffffff',
                            color: '#111111',
                            border: '2px solid #3b82f6',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            outline: 'none',
                            width: '160px',
                          }}
                        />
                      ) : (
                        <span className={`font-bold whitespace-nowrap ${isSelected ? '' : 'text-neutral-700 dark:text-neutral-200'}`}>
                          {pureVersion}
                        </span>
                      )}

                      {/* 다음 업데이트 뱃지 */}
                      {isNextUpdate && !isEditing && (
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border-2 whitespace-nowrap shrink-0 ${
                          isSelected
                            ? 'border-orange-400 text-orange-400 bg-orange-100'
                            : 'border-orange-400 text-orange-500 bg-orange-50 dark:bg-orange-900/30'
                        }`}>
                          {suffix}
                        </span>
                      )}

                      {/* 완료 뱃지 */}
                      {v.is_current && !isEditing && (
                        <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border-2 font-black shrink-0 ${
                          isSelected
                            ? 'border-red-400 text-red-400 bg-red-100'
                            : 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        }`}>완료</span>
                      )}
                    </div>

                    {/* 오른쪽: 액션 버튼 */}
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
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
                        // 버튼 색상: isSelected 시 반전 배경 기준으로 명확하게 대비
                        <div className="flex items-center gap-1">
                          {!v.is_current && (
                            <button
                              onClick={e => toggleNextUpdate(e, v)}
                              style={isNextUpdate
                                ? { border: '2px solid #f97316', color: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }
                                : isSelected
                                  ? { border: '2px solid #555', color: '#333', backgroundColor: 'transparent', borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }
                                  : { border: '2px solid #888', color: '#555', backgroundColor: 'transparent', borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }
                              }
                            >
                              ▶ 다음
                            </button>
                          )}
                          <button
                            onClick={e => toggleComplete(e, v)}
                            style={isSelected
                              ? { border: '2px solid #555', color: '#333', backgroundColor: 'transparent', borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }
                              : { border: '2px solid #888', color: '#555', backgroundColor: 'transparent', borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }
                            }
                          >
                            {v.is_current ? '해제' : '완료'}
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setEditingId(v.id); setEditVer(v.version); }}
                            style={isSelected ? { color: '#555', padding: '2px' } : { color: '#888', padding: '2px' }}
                          >
                            <Pencil size={13} strokeWidth={2.5} />
                          </button>
                          <button
                            onClick={e => handleDelete(e, v.id)}
                            style={isSelected ? { color: '#555', padding: '2px' } : { color: '#888', padding: '2px' }}
                          >
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
