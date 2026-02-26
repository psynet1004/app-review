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

  useEffect(() => {
    supabase.from('app_versions').select('*').order('created_at', { ascending: false })
      .then(({ data }) => {
        const vs = data || [];
        setVersions(vs);
        const aosVs = vs.filter(v => v.platform === 'AOS');
        const iosVs = vs.filter(v => v.platform === 'iOS');
        // 기본: 최신 버전 선택
        if (aosVs.length > 0 && !aosVersion) setAosVersion(aosVs[0].version);
        if (iosVs.length > 0 && !iosVersion) setIosVersion(iosVs[0].version);
      });
  }, []);

  const aosVersions = versions.filter(v => v.platform === 'AOS');
  const iosVersions = versions.filter(v => v.platform === 'iOS');

  return (
    <VersionContext.Provider value={{ aosVersion, iosVersion, setAosVersion, setIosVersion, aosVersions, iosVersions }}>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </VersionContext.Provider>
  );
}
