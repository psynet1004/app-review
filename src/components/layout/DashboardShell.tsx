'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header, { VersionContext } from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/client';
import type { AppVersion } from '@/lib/types/database';

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [aosVersion, setAosVersion] = useState('');
  const [iosVersion, setIosVersion] = useState('');
  const [userName, setUserName] = useState('');
  const [userDept, setUserDept] = useState('');

  const loadVersions = useCallback(async () => {
    const { data } = await supabase
      .from('app_versions')
      .select('*')
      .order('created_at', { ascending: false });
    const vs = data || [];
    setVersions(vs);
    const aosVs = vs.filter(v => v.platform === 'AOS');
    const iosVs = vs.filter(v => v.platform === 'iOS');
    setAosVersion(prev =>
      prev && aosVs.some(v => v.version === prev) ? prev : (aosVs[0]?.version || '')
    );
    setIosVersion(prev =>
      prev && iosVs.some(v => v.version === prev) ? prev : (iosVs[0]?.version || '')
    );
  }, [supabase]);

  useEffect(() => {
    loadVersions();
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      if (u) {
        const name = u.user_metadata?.full_name || u.email || '';
        setUserName(name);
        const email = u.email?.toLowerCase();
        if (email) {
          const { data: dev } = await supabase
            .from('developers')
            .select('department')
            .eq('email', email)
            .single();
          if (dev) setUserDept(dev.department);
        }
      }
    });
  }, [loadVersions, supabase]);

  return (
    <VersionContext.Provider
      value={{
        aosVersion,
        iosVersion,
        setAosVersion,
        setIosVersion,
        aosVersions: versions.filter(v => v.platform === 'AOS'),
        iosVersions: versions.filter(v => v.platform === 'iOS'),
        refreshVersions: loadVersions,
        userName,
        userDept,
      }}
    >
      <div id="dashboard-shell" className="bg-gray-50">
        <Sidebar />
        <div id="dashboard-content">
          <Header />
          <main id="dashboard-main" className="p-6">
            {children}
          </main>
        </div>
      </div>
    </VersionContext.Provider>
  );
}
