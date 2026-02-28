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
    { label: 'AOS 개발항목', value: stats.aosCount, icon: Smartphone, color: 'bg-green-500' },
    { label: 'iOS 개발항목', value: stats.iosCount, icon: Apple, color: 'bg-blue-500' },
    { label: '앱 오류', value: stats.bugCount, icon: Bug, color: 'bg-red-500' },
    { label: '공통 오류', value: stats.commonBugCount, icon: AlertTriangle, color: 'bg-orange-500' },
    { label: '서버 오류', value: stats.serverBugCount, icon: Server, color: 'bg-purple-500' },
    { label: '미전송 항목', value: stats.unsent, icon: Send, color: 'bg-gray-500' },
  ] : [];

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-6">대시보드</h1>

      {!stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-20 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-12" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {cards.map(card => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 ${card.color} rounded-lg flex items-center justify-center`}>
                    <Icon size={14} className="text-white" />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">{card.label}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Logs */}
      {stats?.recentLogs && stats.recentLogs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">최근 전송 이력</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">시각</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">유형</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">대상</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">항목수</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">결과</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.recentLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-600">{new Date(log.sent_at).toLocaleString('ko-KR')}</td>
                    <td className="px-4 py-2">{log.send_type}</td>
                    <td className="px-4 py-2">{log.target_space}</td>
                    <td className="px-4 py-2">{log.item_count}건</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs font-medium ${log.result === '성공' ? 'text-green-600' : 'text-red-600'}`}>
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
