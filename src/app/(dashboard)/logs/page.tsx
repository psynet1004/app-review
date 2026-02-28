'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { SendLog } from '@/lib/types/database';

export default function LogsPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<SendLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('send_logs').select('*').order('sent_at', { ascending: false }).limit(100)
      .then(({ data }: { data: any }) => { setLogs(data || []); setLoading(false); });
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">전송 이력</h1>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['전송일시','전송자','유형','플랫폼','스페이스','항목수','요약','결과'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">로딩 중...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">전송 이력이 없습니다</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap text-xs">{new Date(log.sent_at).toLocaleString('ko-KR')}</td>
                    <td className="px-3 py-2 text-xs">{log.sent_by_email}</td>
                    <td className="px-3 py-2"><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{log.send_type}</span></td>
                    <td className="px-3 py-2 text-xs">{log.target_platform}</td>
                    <td className="px-3 py-2 text-xs">{log.target_space}</td>
                    <td className="px-3 py-2 text-xs font-medium">{log.item_count}건</td>
                    <td className="px-3 py-2 text-xs text-gray-500 max-w-xs truncate">{log.item_summary}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-medium ${log.result === '성공' ? 'text-green-600' : 'text-red-600'}`}>{log.result}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
