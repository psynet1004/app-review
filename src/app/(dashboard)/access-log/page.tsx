'use client';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useVersion } from '@/components/layout/Header';
import { useRouter } from 'next/navigation';
import { Users, Clock, Monitor, Globe } from 'lucide-react';

interface AccessLog {
  id: string;
  user_email: string;
  user_name: string;
  action: string;
  page: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

export default function AccessLogPage() {
  const supabase = createClient();
  const router = useRouter();
  const { userEmail } = useVersion();
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');

  const ADMIN_EMAILS = ['boongss@psynet.co.kr'];

  useEffect(() => {
    if (userEmail && !ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
      router.push('/');
    }
  }, [userEmail, router]);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('access_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (dateFilter) {
      query = query.gte('created_at', dateFilter + 'T00:00:00').lte('created_at', dateFilter + 'T23:59:59');
    }
    if (userFilter) {
      query = query.ilike('user_email', `%${userFilter}%`);
    }

    const { data } = await query;
    setLogs((data as AccessLog[]) || []);
    setLoading(false);
  }, [dateFilter, userFilter]);

  useEffect(() => { load(); }, [load]);

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,'0')}.${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}:${String(dt.getSeconds()).padStart(2,'0')}`;
  };

  const actionLabel = (action: string) => {
    const map: Record<string, { label: string; color: string }> = {
      'login': { label: '로그인', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
      'page_view': { label: '페이지', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
      'logout': { label: '로그아웃', color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400' },
    };
    const m = map[action] || { label: action, color: 'bg-neutral-100 text-neutral-600' };
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.color}`}>{m.label}</span>;
  };

  // Group by unique users today
  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogs = logs.filter(l => l.created_at.startsWith(todayStr));
  const uniqueToday = new Set(todayLogs.map(l => l.user_email)).size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Users size={22} /> 접속 로그
        </h1>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">사용자 접속 및 활동 이력</p>
      </div>

      {/* Summary */}
      <div className="flex gap-3">
        <div className="bg-white dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-700 rounded-lg px-4 py-3">
          <div className="text-[10px] font-bold text-neutral-400 uppercase">오늘 접속자</div>
          <div className="text-2xl font-black text-neutral-900 dark:text-white">{uniqueToday}명</div>
        </div>
        <div className="bg-white dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-700 rounded-lg px-4 py-3">
          <div className="text-[10px] font-bold text-neutral-400 uppercase">오늘 활동</div>
          <div className="text-2xl font-black text-neutral-900 dark:text-white">{todayLogs.length}건</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="border-2 border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-black dark:text-white rounded-md px-3 py-1.5 text-sm font-medium focus:border-black dark:focus:border-white focus:outline-none" />
        <input type="text" value={userFilter} onChange={e => setUserFilter(e.target.value)} placeholder="이메일 검색..."
          className="border-2 border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-black dark:text-white rounded-md px-3 py-1.5 text-sm font-medium focus:border-black dark:focus:border-white focus:outline-none w-60" />
        {(dateFilter || userFilter) && (
          <button onClick={() => { setDateFilter(''); setUserFilter(''); }}
            className="text-xs font-bold text-red-500 hover:underline">초기화</button>
        )}
      </div>

      {/* Log Table */}
      <div className="bg-white dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-100 dark:bg-neutral-800 border-b-2 border-neutral-200 dark:border-neutral-700">
              <th className="px-4 py-2.5 text-xs font-black text-neutral-500 text-left">시간</th>
              <th className="px-4 py-2.5 text-xs font-black text-neutral-500 text-left">사용자</th>
              <th className="px-4 py-2.5 text-xs font-black text-neutral-500 text-center">활동</th>
              <th className="px-4 py-2.5 text-xs font-black text-neutral-500 text-left">페이지</th>
              <th className="px-4 py-2.5 text-xs font-black text-neutral-500 text-left">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-neutral-400">로딩 중...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-neutral-400">로그가 없습니다</td></tr>
            ) : logs.map(log => (
              <tr key={log.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                <td className="px-4 py-2.5 text-xs text-neutral-500 whitespace-nowrap">
                  <Clock size={10} className="inline mr-1" />{formatDate(log.created_at)}
                </td>
                <td className="px-4 py-2.5">
                  <div className="text-xs font-bold text-neutral-900 dark:text-white">{log.user_name || '-'}</div>
                  <div className="text-[10px] text-neutral-400">{log.user_email}</div>
                </td>
                <td className="px-4 py-2.5 text-center">{actionLabel(log.action)}</td>
                <td className="px-4 py-2.5 text-xs text-neutral-600 dark:text-neutral-400">{log.page || '-'}</td>
                <td className="px-4 py-2.5 text-xs text-neutral-400">{log.ip_address || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 border-t-2 border-neutral-200 dark:border-neutral-700 text-xs text-neutral-500 font-bold">
          총 {logs.length}건 (최대 200건)
        </div>
      </div>
    </div>
  );
}
