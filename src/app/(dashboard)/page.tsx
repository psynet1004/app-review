'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Smartphone, Apple, Bug, AlertTriangle, Server, Send } from 'lucide-react';

interface Stats {
  aosCount: number; iosCount: number;
  bugCount: number; commonBugCount: number; serverBugCount: number;
  unsent: number; recentLogs: any[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const [aos, ios, bugs, common, server, unsent, logs] = await Promise.all([
        supabase.from('dev_items').select('id', { count: 'exact', head: true }).eq('platform', 'AOS'),
        supabase.from('dev_items').select('id', { count: 'exact', head: true }).eq('platform', 'iOS'),
        supabase.from('bug_items').select('id', { count: 'exact', head: true }),
        supabase.from('common_bugs').select('id', { count: 'exact', head: true }),
        supabase.from('server_bugs').select('id', { count: 'exact', head: true }),
        supabase.from('dev_items').select('id', { count: 'exact', head: true }).eq('send_status', '미전송'),
        supabase.from('send_logs').select('*').order('sent_at', { ascending: false }).limit(5),
      ]);

      setStats({
        aosCount: aos.count || 0, iosCount: ios.count || 0,
        bugCount: bugs.count || 0, commonBugCount: common.count || 0,
        serverBugCount: server.count || 0, unsent: unsent.count || 0,
        recentLogs: logs.data || [],
      });
    }
    load();
  }, []);

  const cards = stats ? [
    { label: 'AOS 개발', value: stats.aosCount, icon: Smartphone, accent: false },
    { label: 'iOS 개발', value: stats.iosCount, icon: Apple, accent: false },
    { label: '앱 오류', value: stats.bugCount, icon: Bug, accent: true },
    { label: '공통 오류', value: stats.commonBugCount, icon: AlertTriangle, accent: false },
    { label: '서버 오류', value: stats.serverBugCount, icon: Server, accent: false },
    { label: '미전송', value: stats.unsent, icon: Send, accent: stats.unsent > 0 },
  ] : [];

  return (
    <div>
      <h1 className="text-xl font-black text-black dark:text-white mb-6 tracking-tight">대시보드</h1>

      {!stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-neutral-900 rounded-lg border-2 border-neutral-300 dark:border-neutral-700 p-4 animate-pulse">
              <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-20 mb-3" />
              <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-12" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {cards.map(card => {
            const Icon = card.icon;
            return (
              <div key={card.label} className={`bg-white dark:bg-neutral-900 rounded-lg border-2 p-4 transition-all hover:-translate-y-0.5 ${card.accent ? 'border-red-500 shadow-[3px_3px_0_0_rgba(239,68,68,1)]' : 'border-black dark:border-neutral-600 shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:shadow-[3px_3px_0_0_rgba(255,255,255,0.05)]'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-8 h-8 rounded-md border-2 flex items-center justify-center ${card.accent ? 'bg-red-600 border-red-700' : 'bg-black dark:bg-white border-black dark:border-white'}`}>
                    <Icon size={15} strokeWidth={2.5} className={card.accent ? 'text-white' : 'text-white dark:text-black'} />
                  </div>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 font-bold uppercase tracking-wide">{card.label}</span>
                </div>
                <p className={`text-3xl font-black ${card.accent && card.value > 0 ? 'text-red-600 dark:text-red-400' : 'text-black dark:text-white'}`}>{card.value}</p>
              </div>
            );
          })}
        </div>
      )}

      {stats?.recentLogs && stats.recentLogs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-black text-neutral-700 dark:text-neutral-300 mb-3 uppercase tracking-wide">최근 전송 이력</h2>
          <div className="bg-white dark:bg-neutral-900 rounded-lg border-2 border-black dark:border-neutral-700 shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:shadow-[3px_3px_0_0_rgba(255,255,255,0.05)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-100 dark:bg-neutral-800 border-b-2 border-black dark:border-neutral-700">
                  <th className="px-4 py-2.5 text-left text-xs font-black text-neutral-600 dark:text-neutral-400 uppercase">시각</th>
                  <th className="px-4 py-2.5 text-left text-xs font-black text-neutral-600 dark:text-neutral-400 uppercase">유형</th>
                  <th className="px-4 py-2.5 text-left text-xs font-black text-neutral-600 dark:text-neutral-400 uppercase">대상</th>
                  <th className="px-4 py-2.5 text-left text-xs font-black text-neutral-600 dark:text-neutral-400 uppercase">항목수</th>
                  <th className="px-4 py-2.5 text-left text-xs font-black text-neutral-600 dark:text-neutral-400 uppercase">결과</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {stats.recentLogs.map(log => (
                  <tr key={log.id} className="hover:bg-stone-50 dark:hover:bg-neutral-800/50">
                    <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400 font-medium">{new Date(log.sent_at).toLocaleString('ko-KR')}</td>
                    <td className="px-4 py-2.5 font-bold text-black dark:text-white">{log.send_type}</td>
                    <td className="px-4 py-2.5 font-medium">{log.target_space}</td>
                    <td className="px-4 py-2.5 font-bold">{log.item_count}건</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-black px-2 py-0.5 rounded border-2 ${log.result === '성공' ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white' : 'bg-red-50 text-red-600 border-red-500'}`}>
                        {log.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
