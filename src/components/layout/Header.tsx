'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, createContext, useContext, useRef } from 'react';
import { LogOut, User, ChevronDown, Plus, Trash2, Moon, Sun } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { AppVersion } from '@/lib/types/database';
import { useDark } from '@/components/layout/DashboardShell';

export const VersionContext = createContext<{
  aosVersion: string; iosVersion: string;
  setAosVersion: (v: string) => void; setIosVersion: (v: string) => void;
  aosVersions: AppVersion[]; iosVersions: AppVersion[];
  refreshVersions: () => void; userName: string; userDept: string;
}>({
  aosVersion: '', iosVersion: '', setAosVersion: () => {}, setIosVersion: () => {},
  aosVersions: [], iosVersions: [], refreshVersions: () => {}, userName: '', userDept: '',
});

export function useVersion() { return useContext(VersionContext); }

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
        <button onClick={handleLogout} className="p-2 rounded-md border-2 border-neutral-300 dark:border-neutral-600 hover:border-red-500 text-neutral-400 hover:text-red-500 transition-all" title="로그아웃"><LogOut size={16} strokeWidth={2.5} /></button>
      </div>
    </header>
  );
}

function VersionDropdown({ label, versions, selected, onSelect, refresh }: { label: string; versions: AppVersion[]; selected: string; onSelect: (v: string) => void; refresh: () => void; }) {
  const [open, setOpen] = useState(false);
  const [newVer, setNewVer] = useState('');
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const router = useRouter();
  const platform = label as 'AOS' | 'iOS';
  const handleAdd = async () => { if (!newVer.trim()) return; await supabase.from('app_versions').insert({ platform, version: newVer.trim(), is_current: false }); setNewVer(''); refresh(); };
  const handleDelete = async (e: React.MouseEvent, id: string) => { e.stopPropagation(); if (!confirm('삭제?')) return; await supabase.from('app_versions').delete().eq('id', id); refresh(); };
  const toggleComplete = async (e: React.MouseEvent, v: AppVersion) => { e.stopPropagation(); await supabase.from('app_versions').update({ is_current: !v.is_current }).eq('id', v.id); refresh(); };

  return (
    <div className="relative">
      <div className="flex items-center border-2 border-black dark:border-neutral-600 bg-white dark:bg-neutral-800 rounded-md overflow-hidden">
        <button onClick={() => router.push(label === 'AOS' ? '/dev/aos' : '/dev/ios')} className="flex items-center gap-2 text-xs text-black dark:text-white px-3 py-1.5 font-bold hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all">
          <span className="w-2.5 h-2.5 rounded-full bg-black dark:bg-white" />{label} {selected || '미설정'}
        </button>
        <button onClick={() => setOpen(!open)} className="px-1.5 py-1.5 border-l-2 border-black dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all">
          <ChevronDown size={12} strokeWidth={3} className={`transition text-black dark:text-white ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (<>
        <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
        <div className="absolute top-full left-0 mt-2 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-600 rounded-lg shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,0.1)] z-30 min-w-[240px] overflow-hidden">
          <div className="px-4 py-2 text-[10px] font-black text-neutral-500 uppercase tracking-widest border-b-2 border-black dark:border-neutral-700">{label} 버전</div>
          <div className="max-h-60 overflow-y-auto">
            {versions.map(v => (
              <div key={v.id} onClick={() => { onSelect(v.version); setOpen(false); }} className={`flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer group transition-all border-b border-neutral-100 dark:border-neutral-800 ${v.version === selected ? 'bg-black text-white dark:bg-white dark:text-black' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}>
                <div className="flex items-center gap-2.5">
                  <span className={`font-bold ${v.version === selected ? '' : 'text-neutral-700 dark:text-neutral-300'}`}>{v.version}</span>
                  {v.is_current && <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border-2 border-red-500 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-black">완료</span>}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={e => toggleComplete(e, v)} className="text-[10px] px-1.5 py-0.5 rounded border border-neutral-300 dark:border-neutral-600 font-bold">{v.is_current ? '해제' : '완료'}</button>
                  <button onClick={e => handleDelete(e, v.id)} className="text-neutral-400 hover:text-red-500"><Trash2 size={13} strokeWidth={2.5} /></button>
                </div>
              </div>
            ))}
          </div>
          {versions.length === 0 && <div className="px-4 py-3 text-xs text-neutral-400 text-center font-medium">버전 없음</div>}
          <div className="border-t-2 border-black dark:border-neutral-700 px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <input type="text" value={newVer} onChange={e => setNewVer(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="새 버전 (예: V52.0.0)" className="flex-1 text-xs border-2 border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-black dark:text-white rounded-md px-2.5 py-1.5 font-medium focus:border-black dark:focus:border-white focus:outline-none" />
              <button onClick={handleAdd} disabled={!newVer.trim()} className="p-1.5 bg-black dark:bg-white text-white dark:text-black rounded-md border-2 border-black dark:border-white hover:shadow-[2px_2px_0_0_rgba(0,0,0,0.5)] disabled:opacity-30 font-bold"><Plus size={14} strokeWidth={3} /></button>
            </div>
          </div>
        </div>
      </>)}
    </div>
  );
}
