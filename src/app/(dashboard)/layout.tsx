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

  const loadVersions = useCallback(async () => {
    const { data } = await supabase.from('app_versions').select('*').order('created_at', { ascending: false });
    const vs = data || [];
    setVersions(vs);
    const aosVs = vs.filter(v => v.platform === 'AOS');
    const iosVs = vs.filter(v => v.platform === 'iOS');
    // 최초 로드 시에만 기본 버전 설정
    setAosVersion(prev => prev && aosVs.some(v => v.version === prev) ? prev : (aosVs[0]?.version || ''));
    setIosVersion(prev => prev && iosVs.some(v => v.version === prev) ? prev : (iosVs[0]?.version || ''));
  }, []);

  useEffect(() => { loadVersions(); }, [loadVersions]);

  return (
    <VersionContext.Provider value={{
      aosVersion, iosVersion, setAosVersion, setIosVersion,
      aosVersions: versions.filter(v => v.platform === 'AOS'),
      iosVersions: versions.filter(v => v.platform === 'iOS'),
      refreshVersions: loadVersions,
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
