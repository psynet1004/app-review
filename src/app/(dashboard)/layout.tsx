'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header, { VersionContext } from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/client';
import type { AppVersion } from '@/lib/types/database';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [aosVersion, setAosVersion] = useState('');
  const [iosVersion, setIosVersion] = useState('');
  const [userName, setUserName] = useState('');
  const [userDept, setUserDept] = useState('');

  const loadVersions = useCallback(async () => {
    const { data } = await supabase.from('app_versions').select('*').order('created_at', { ascending: false });
    const vs = data || [];
    setVersions(vs);
    const aosVs = vs.filter(v => v.platform === 'AOS');
    const iosVs = vs.filter(v => v.platform === 'iOS');
    setAosVersion(prev => prev && aosVs.some(v => v.version === prev) ? prev : (aosVs[0]?.version || ''));
    setIosVersion(prev => prev && iosVs.some(v => v.version === prev) ? prev : (iosVs[0]?.version || ''));
  }, []);

  useEffect(() => {
    loadVersions();
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      if (u) {
        const name = u.user_metadata?.full_name || u.email || '';
        setUserName(name);
        // developers 테이블에서 이메일로 부서 조회
        const email = u.email?.toLowerCase();
        if (email) {
          const { data: dev } = await supabase.from('developers').select('department').eq('email', email).single();
          if (dev) setUserDept(dev.department);
        }
      }
    });
  }, [loadVersions]);

  return (
    <VersionContext.Provider value={{
      aosVersion, iosVersion, setAosVersion, setIosVersion,
      aosVersions: versions.filter(v => v.platform === 'AOS'),
      iosVersions: versions.filter(v => v.platform === 'iOS'),
      refreshVersions: loadVersions, userName, userDept,
    }}>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </VersionContext.Provider>
  );
}
