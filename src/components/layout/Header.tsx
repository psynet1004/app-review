'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, createContext, useContext } from 'react';
import { LogOut, User, ChevronDown, Plus, Trash2, X } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { AppVersion } from '@/lib/types/database';

// Context for sharing selected version across pages
export const VersionContext = createContext<{
  aosVersion: string; iosVersion: string;
  setAosVersion: (v: string) => void; setIosVersion: (v: string) => void;
  aosVersions: AppVersion[]; iosVersions: AppVersion[];
}>({ aosVersion: '', iosVersion: '', setAosVersion: () => {}, setIosVersion: () => {}, aosVersions: [], iosVersions: [] });

export function useVersion() { return useContext(VersionContext); }

export default function Header() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const supabase = createClient();
  const { aosVersion, iosVersion, setAosVersion, setIosVersion, aosVersions, iosVersions } = useVersion();

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUser(data.user)); }, []);

  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = '/login'; };

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <VersionDropdown label="AOS" versions={aosVersions} selected={aosVersion} onSelect={setAosVersion} color="green" />
        <VersionDropdown label="iOS" versions={iosVersions} selected={iosVersion} onSelect={setIosVersion} color="blue" />
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
              {user.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="" className="w-7 h-7 rounded-full" /> : <User size={14} />}
            </div>
            <span className="hidden sm:inline">{user.user_metadata?.full_name || user.email}</span>
          </div>
        )}
        <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="로그아웃"><LogOut size={16} /></button>
      </div>
    </header>
  );
}

function VersionDropdown({ label, versions, selected, onSelect, color }: {
  label: string; versions: AppVersion[]; selected: string; onSelect: (v: string) => void; color: 'green' | 'blue';
}) {
  const [open, setOpen] = useState(false);
  const [newVer, setNewVer] = useState('');
  const supabase = createClient();

  const cc = color === 'green'
    ? { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' }
    : { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' };

  const platform = label as 'AOS' | 'iOS';
  const cur = versions.find(v => v.version === selected);

  const handleAdd = async () => {
    if (!newVer.trim()) return;
    await supabase.from('app_versions').insert({ platform, version: newVer.trim(), is_current: false });
    setNewVer('');
    window.location.reload();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 버전을 삭제할까요?')) return;
    await supabase.from('app_versions').delete().eq('id', id);
    window.location.reload();
  };

  const toggleComplete = async (v: AppVersion) => {
    await supabase.from('app_versions').update({ is_current: !v.is_current }).eq('id', v.id);
    window.location.reload();
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 text-xs ${cc.bg} ${cc.text} px-2.5 py-1 rounded-full font-medium hover:opacity-80`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cc.dot}`} />
        {label} {selected || '미설정'}
        <ChevronDown size={12} />
      </button>
      {open && (<>
        <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 min-w-[220px] py-1">
          <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase">{label} 버전</div>
          {versions.map(v => (
            <div key={v.id}
              className={`flex items-center justify-between px-3 py-1.5 text-xs hover:bg-gray-50 group cursor-pointer ${v.version === selected ? 'bg-blue-50' : ''}`}>
              <div className="flex items-center gap-2 flex-1" onClick={() => { onSelect(v.version); setOpen(false); }}>
                <span className={v.version === selected ? 'font-bold text-gray-900' : 'text-gray-600'}>{v.version}</span>
                {v.is_current && <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">🔴 완료</span>}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={(e) => { e.stopPropagation(); toggleComplete(v); }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-[10px] px-1" title={v.is_current ? '완료 해제' : '완료 처리'}>
                  {v.is_current ? '해제' : '완료'}
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(v.id); }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
          {versions.length === 0 && <div className="px-3 py-2 text-xs text-gray-400">버전 없음</div>}
          <div className="border-t border-gray-100 mt-1 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <input type="text" value={newVer} onChange={e => setNewVer(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="새 버전 (예: V52.0.0)" className="flex-1 text-xs border border-gray-200 rounded px-2 py-1" />
              <button onClick={handleAdd} disabled={!newVer.trim()} className="text-blue-600 hover:text-blue-800 disabled:opacity-40"><Plus size={16} /></button>
            </div>
          </div>
        </div>
      </>)}
    </div>
  );
}
