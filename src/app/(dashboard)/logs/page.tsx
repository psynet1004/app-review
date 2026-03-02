'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { SendLog } from '@/lib/types/database';

const ADMIN_EMAIL = 'boongss@psynet.co.kr';

export default function LogsPage() {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const router = useRouter();
  const [logs, setLogs] = useState<SendLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: any }) => {
      if (data.user?.email !== ADMIN_EMAIL) { router.replace('/'); return; }
      setIsAdmin(true);
      setAuthorized(true);
    });
    loadLogs();
  }, []);

  const loadLogs = () => {
    setLoading(true);
    supabase.from('send_logs').select('*').order('sent_at', { ascending: false }).limit(100)
      .then(({ data }: { data: any }) => { setLogs(data || []); setLoading(false); });
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === logs.length) setSelected(new Set());
    else setSelected(new Set(logs.map(l => l.id)));
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size}건의 전송 이력을 삭제하시겠습니까?`)) return;
    const ids = Array.from(selected);
    await supabase.from('send_logs').delete().in('id', ids);
    setSelected(new Set());
    loadLogs();
  };

  if (!authorized) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">전송 이력</h1>
        {isAdmin && selected.size > 0 && (
          <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-500 border-2 border-black rounded-md hover:bg-red-600 shadow-[2px_2px_0_0_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all">
            <Trash2 size={13}/>{selected.size}건 삭제
          </button>
        )}
      </div>
      <div className="bg-white dark:bg-neutral-900 rounded-xl border-2 border-black dark:border-neutral-700 shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:shadow-[3px_3px_0_0_rgba(255,255,255,0.05)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-100 dark:bg-neutral-800 border-b-2 border-black dark:border-neutral-700">
                {isAdmin && (
                  <th className="px-3 py-2.5 w-8"><input type="checkbox" checked={logs.length>0&&selected.size===logs.length} onChange={toggleAll} className="rounded"/></th>
                )}
                {['전송일시','전송자','유형','플랫폼','스페이스','항목수','요약','결과'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-black text-neutral-600 dark:text-neutral-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {loading ? (
                <tr><td colSpan={isAdmin?9:8} className="px-4 py-12 text-center text-neutral-400">로딩 중...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={isAdmin?9:8} className="px-4 py-12 text-center text-neutral-400">전송 이력이 없습니다</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    {isAdmin && (
                      <td className="px-3 py-2"><input type="checkbox" checked={selected.has(log.id)} onChange={()=>toggleSelect(log.id)} className="rounded"/></td>
                    )}
                    <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400 whitespace-nowrap text-xs">{new Date(log.sent_at).toLocaleString('ko-KR')}</td>
                    <td className="px-3 py-2 text-xs dark:text-neutral-300">{log.sent_by_email}</td>
                    <td className="px-3 py-2"><span className="text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-2 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700">{log.send_type}</span></td>
                    <td className="px-3 py-2 text-xs dark:text-neutral-300">{log.target_platform}</td>
                    <td className="px-3 py-2 text-xs dark:text-neutral-300">{log.target_space}</td>
                    <td className="px-3 py-2 text-xs font-bold dark:text-white">{log.item_count}건</td>
                    <td className="px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400 max-w-xs truncate">{log.item_summary}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-bold ${log.result === '성공' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{log.result}</span>
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
