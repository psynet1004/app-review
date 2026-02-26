'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { LogOut, User, ChevronDown, Plus, Trash2, CheckCircle2, Circle, X } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { AppVersion } from '@/lib/types/database';

export default function Header() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const supabase = createClient();

  const loadVersions = async () => {
    const { data } = await supabase.from('app_versions').select('*').order('created_at', { ascending: false });
    setVersions(data || []);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    loadVersions();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const aosVersions = versions.filter(v => v.platform === 'AOS');
  const iosVersions = versions.filter(v => v.platform === 'iOS');
  const aosCurrent = aosVersions.find(v => v.is_current);
  const iosCurrent = iosVersions.find(v => v.is_current);

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <VersionDropdown label="AOS" current={aosCurrent} versions={aosVersions} color="green"
          supabase={supabase} platform="AOS" onUpdate={loadVersions} />
        <VersionDropdown label="iOS" current={iosCurrent} versions={iosVersions} color="blue"
          supabase={supabase} platform="iOS" onUpdate={loadVersions} />
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="" className="w-7 h-7 rounded-full" />
              ) : (
                <User size={14} />
              )}
            </div>
            <span className="hidden sm:inline">{user.user_metadata?.full_name || user.email}</span>
          </div>
        )}
        <button onClick={handleLogout}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="로그아웃">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}

function VersionDropdown({ label, current, versions, color, supabase, platform, onUpdate }: {
  label: string; current?: AppVersion; versions: AppVersion[]; color: 'green' | 'blue';
  supabase: any; platform: 'AOS' | 'iOS'; onUpdate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [newVer, setNewVer] = useState('');
  const [adding, setAdding] = useState(false);

  const colorCls = color === 'green'
    ? { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' }
    : { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' };

  const handleAdd = async () => {
    if (!newVer.trim()) return;
    setAdding(true);
    await supabase.from('app_versions').insert({ platform, version: newVer.trim(), is_current: versions.length === 0 });
    setNewVer(''); setAdding(false); onUpdate();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 버전을 삭제할까요?')) return;
    await supabase.from('app_versions').delete().eq('id', id);
    onUpdate();
  };

  const toggleComplete = async (v: AppVersion) => {
    await supabase.from('app_versions').update({ is_current: !v.is_current }).eq('id', v.id);
    onUpdate();
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 text-xs ${colorCls.bg} ${colorCls.text} px-2.5 py-1 rounded-full font-medium hover:opacity-80 transition-opacity`}>
        <span className={`w-1.5 h-1.5 rounded-full ${colorCls.dot}`} />
        {label} {current?.version || '미설정'}
        <ChevronDown size={12} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 min-w-[220px] py-1">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase">{label} 버전</div>

            {versions.map(v => (
              <div key={v.id} className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-gray-50 group">
                <div className="flex items-center gap-2 flex-1">
                  {/* 완료 토글 버튼 */}
                  <button onClick={() => toggleComplete(v)} title={v.is_current ? '완료 해제' : '업데이트 완료'} className="flex-shrink-0">
                    {v.is_current
                      ? <CheckCircle2 size={16} className="text-green-500 hover:text-gray-400" />
                      : <Circle size={16} className="text-gray-300 hover:text-green-500" />
                    }
                  </button>
                  <span className={v.is_current ? 'font-bold text-gray-900' : 'text-gray-600'}>{v.version}</span>
                  {v.is_current && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">완료</span>}
                </div>
                {/* 삭제 버튼 */}
                <button onClick={() => handleDelete(v.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity flex-shrink-0 ml-2">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}

            {versions.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-400">버전 없음</div>
            )}

            {/* 버전 추가 */}
            <div className="border-t border-gray-100 mt-1 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <input
                  type="text" value={newVer} onChange={e => setNewVer(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  placeholder="새 버전 (예: V52.0.0)"
                  className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-400 focus:border-transparent"
                />
                <button onClick={handleAdd} disabled={adding || !newVer.trim()}
                  className="text-blue-600 hover:text-blue-800 disabled:opacity-40 flex-shrink-0">
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
