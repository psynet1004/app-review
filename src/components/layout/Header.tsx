'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { LogOut, User, ChevronDown } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { AppVersion } from '@/lib/types/database';

export default function Header() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    supabase.from('app_versions').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setVersions(data || []));
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
        {/* AOS versions */}
        <VersionDropdown
          label="AOS"
          current={aosCurrent}
          versions={aosVersions}
          color="green"
        />
        {/* iOS versions */}
        <VersionDropdown
          label="iOS"
          current={iosCurrent}
          versions={iosVersions}
          color="blue"
        />
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
        <button
          onClick={handleLogout}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="로그아웃"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}

function VersionDropdown({ label, current, versions, color }: {
  label: string; current?: AppVersion; versions: AppVersion[]; color: 'green' | 'blue';
}) {
  const [open, setOpen] = useState(false);
  const colorClasses = color === 'green'
    ? { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' }
    : { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 text-xs ${colorClasses.bg} ${colorClasses.text} px-2.5 py-1 rounded-full font-medium hover:opacity-80 transition-opacity`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${colorClasses.dot}`} />
        {label} {current?.version || '미설정'}
        {versions.length > 1 && <ChevronDown size={12} />}
      </button>

      {open && versions.length > 0 && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 min-w-[140px] py-1">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase">{label} 버전</div>
            {versions.map(v => (
              <div key={v.id} className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-gray-50">
                <span className={v.is_current ? 'font-bold text-gray-900' : 'text-gray-600'}>{v.version}</span>
                {v.is_current && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">현재</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
