'use client';

import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header, { VersionContext } from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/client';
import type { AppVersion } from '@/lib/types/database';

export const DarkContext = createContext<{ dark: boolean; toggle: () => void }>({ dark: false, toggle: () => {} });
export function useDark() { return useContext(DarkContext); }

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [aosVersion, setAosVersion] = useState('');
  const [iosVersion, setIosVersion] = useState('');
  const [serverVersion, setServerVersion] = useState('');
  const [userName, setUserName] = useState('');
  const [userDept, setUserDept] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') { setDark(true); document.documentElement.classList.add('dark'); }
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const loadVersions = useCallback(async () => {
    const { data } = await supabase
      .from('app_versions')
      .select('*')
      .order('created_at', { ascending: false });
    const vs: AppVersion[] = (data as AppVersion[]) || [];
    setVersions(vs);
    const aosVs = vs.filter(v => v.platform === 'AOS');
    const iosVs = vs.filter(v => v.platform === 'iOS');
    const serverVs = vs.filter(v => v.platform === 'SERVER');
    // 완료(is_current=true) 처리 없는 버전 중 가장 낮은(오래된) 버전, 없으면 첫 번째
    const activeVer = (vs: AppVersion[]) => {
      const incomplete = vs.filter(v => !v.is_current);
      return incomplete[incomplete.length - 1]?.version || vs[0]?.version || '';
    };
    // 순수 버전명(괄호 제거)으로 비교: 버전명 수정/다음업데이트 토글 시에도 선택 유지
    const pureName = (s: string) => s.replace(/\s*\(.*?\)\s*/g, "").trim();
    const matchVer = (vs: AppVersion[], prev: string) =>
      vs.find(v => v.version === prev || pureName(v.version) === pureName(prev));
    setAosVersion(prev => {
      const matched = prev && matchVer(aosVs, prev);
      return matched ? matched.version : activeVer(aosVs);
    });
    setIosVersion(prev => {
      const matched = prev && matchVer(iosVs, prev);
      return matched ? matched.version : activeVer(iosVs);
    });
    setServerVersion(prev => {
      const matched = prev && matchVer(serverVs, prev);
      return matched ? matched.version : activeVer(serverVs);
    });
  }, [supabase]);

  useEffect(() => {
    loadVersions();
    supabase.auth.getUser().then(async ({ data }: { data: any }) => {
      const u = data.user;
      if (u) {
        const name = u.user_metadata?.full_name || u.email || '';
        setUserName(name);
        const email = u.email?.toLowerCase() || '';
        setUserEmail(email);
        if (email) {
          const { data: dev }: { data: any } = await supabase
            .from('developers')
            .select('department')
            .eq('email', email)
            .single();
          if (dev) setUserDept(dev.department);
        }
        // Log access
        supabase.from('access_logs').insert({
          user_email: email,
          user_name: name,
          action: 'login',
          page: window.location.pathname,
        }).then(() => {});
      }
    });
  }, [loadVersions, supabase]);

  return (
    <DarkContext.Provider value={{ dark, toggle: toggleDark }}>
      <VersionContext.Provider
        value={{
          aosVersion, iosVersion, serverVersion, setAosVersion, setIosVersion, setServerVersion,
          aosVersions: versions.filter(v => v.platform === 'AOS'),
          iosVersions: versions.filter(v => v.platform === 'iOS'),
          serverVersions: versions.filter(v => v.platform === 'SERVER'),
          refreshVersions: loadVersions, userName, userDept, userEmail,
        }}
      >
        <div id="dashboard-shell" className="bg-stone-100 dark:bg-neutral-950">
          <Sidebar />
          <div id="dashboard-content">
            <Header />
            <main id="dashboard-main" className="p-6">
              {children}
            </main>
          </div>
        </div>
      </VersionContext.Provider>
    </DarkContext.Provider>
  );
}
