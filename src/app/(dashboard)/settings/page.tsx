'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Trash2, TestTube, Star } from 'lucide-react';
import type { Developer, WebhookConfig, AppVersion } from '@/lib/types/database';

export default function SettingsPage() {
  const supabase = createClient();
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [tab, setTab] = useState<'developers' | 'webhooks' | 'versions'>('developers');

  const loadData = async () => {
    const [devs, wh, ver] = await Promise.all([
      supabase.from('developers').select('*').order('name'),
      supabase.from('webhook_configs').select('*').order('space_name'),
      supabase.from('app_versions').select('*').order('created_at', { ascending: false }),
    ]);
    setDevelopers(devs.data || []);
    setWebhooks(wh.data || []);
    setVersions(ver.data || []);
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">설정</h1>

      <div className="flex gap-2 mb-4">
        {[
          { key: 'developers' as const, label: '개발자 관리' },
          { key: 'webhooks' as const, label: 'Webhook 설정' },
          { key: 'versions' as const, label: '버전 관리' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'developers' && <DeveloperManager supabase={supabase} developers={developers} reload={loadData} />}
      {tab === 'webhooks' && <WebhookManager supabase={supabase} webhooks={webhooks} reload={loadData} />}
      {tab === 'versions' && <VersionManager supabase={supabase} versions={versions} reload={loadData} />}
    </div>
  );
}

function VersionManager({ supabase, versions, reload }: { supabase: any; versions: AppVersion[]; reload: () => void }) {
  const [form, setForm] = useState({ platform: 'AOS', version: '' });

  const aosVersions = versions.filter(v => v.platform === 'AOS');
  const iosVersions = versions.filter(v => v.platform === 'iOS');

  const handleAdd = async () => {
    if (!form.version.trim()) return;
    const isFirst = versions.filter(v => v.platform === form.platform).length === 0;
    await supabase.from('app_versions').insert({ ...form, is_current: isFirst });
    setForm({ platform: form.platform, version: '' });
    reload();
  };

  const handleSetCurrent = async (id: string, platform: string) => {
    // 해당 플랫폼의 모든 버전 is_current = false
    await supabase.from('app_versions').update({ is_current: false }).eq('platform', platform);
    // 선택한 버전만 true
    await supabase.from('app_versions').update({ is_current: true }).eq('id', id);
    reload();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 버전을 삭제할까요?')) return;
    await supabase.from('app_versions').delete().eq('id', id);
    reload();
  };

  return (
    <div className="space-y-6">
      {/* Add form */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">버전 추가</h3>
        <div className="flex items-center gap-2">
          <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option value="AOS">AOS</option>
            <option value="iOS">iOS</option>
          </select>
          <input type="text" placeholder="V51.0.4" value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-32 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <button onClick={handleAdd} className="flex items-center gap-1 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-700">
            <Plus size={14}/> 추가
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* AOS */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-green-50">
            <h3 className="text-sm font-bold text-green-700">AOS 버전</h3>
          </div>
          {aosVersions.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">등록된 버전이 없습니다</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {aosVersions.map(v => (
                <div key={v.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${v.is_current ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{v.version}</span>
                    {v.is_current && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">현재</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    {!v.is_current && (
                      <button onClick={() => handleSetCurrent(v.id, 'AOS')} title="현재 버전으로 설정"
                        className="p-1 text-gray-400 hover:text-yellow-500"><Star size={14}/></button>
                    )}
                    <button onClick={() => handleDelete(v.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* iOS */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-blue-50">
            <h3 className="text-sm font-bold text-blue-700">iOS 버전</h3>
          </div>
          {iosVersions.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">등록된 버전이 없습니다</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {iosVersions.map(v => (
                <div key={v.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${v.is_current ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{v.version}</span>
                    {v.is_current && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">현재</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    {!v.is_current && (
                      <button onClick={() => handleSetCurrent(v.id, 'iOS')} title="현재 버전으로 설정"
                        className="p-1 text-gray-400 hover:text-yellow-500"><Star size={14}/></button>
                    )}
                    <button onClick={() => handleDelete(v.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DeveloperManager({ supabase, developers, reload }: { supabase: any; developers: Developer[]; reload: () => void }) {
  const [form, setForm] = useState({ name: '', platform: 'AOS', role: '개발', department: '' });

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    await supabase.from('developers').insert(form);
    setForm({ name: '', platform: 'AOS', role: '개발', department: '' });
    reload();
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await supabase.from('developers').update({ is_active: !isActive }).eq('id', id);
    reload();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 개발자를 삭제할까요?')) return;
    await supabase.from('developers').delete().eq('id', id);
    reload();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <input type="text" placeholder="이름" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-28 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          {['AOS','iOS','SERVER','COMMON'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="text" placeholder="역할" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-24 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        <input type="text" placeholder="부서" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-24 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        <button onClick={handleAdd} className="flex items-center gap-1 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-700">
          <Plus size={14}/> 추가
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {['이름','플랫폼','역할','부서','상태',''].map(h => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {developers.map(dev => (
            <tr key={dev.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-medium">{dev.name}</td>
              <td className="px-3 py-2"><span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{dev.platform}</span></td>
              <td className="px-3 py-2 text-gray-600">{dev.role}</td>
              <td className="px-3 py-2 text-gray-600">{dev.department}</td>
              <td className="px-3 py-2">
                <button onClick={() => handleToggle(dev.id, dev.is_active)}
                  className={`text-xs font-medium ${dev.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                  {dev.is_active ? '활성' : '비활성'}
                </button>
              </td>
              <td className="px-3 py-2">
                <button onClick={() => handleDelete(dev.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WebhookManager({ supabase, webhooks, reload }: { supabase: any; webhooks: WebhookConfig[]; reload: () => void }) {
  const [form, setForm] = useState({ space_name: '', target_platform: 'AOS', webhook_url: '' });
  const [testing, setTesting] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!form.space_name || !form.webhook_url) return;
    await supabase.from('webhook_configs').insert(form);
    setForm({ space_name: '', target_platform: 'AOS', webhook_url: '' });
    reload();
  };

  const handleTest = async (wh: WebhookConfig) => {
    setTesting(wh.id);
    try {
      const res = await fetch(wh.webhook_url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `🧪 [테스트] 앱 검수 관리 시스템 Webhook 연결 테스트입니다.\n스페이스: ${wh.space_name}` }),
      });
      alert(res.ok ? '테스트 전송 성공!' : '전송 실패');
    } catch { alert('연결 실패 - URL을 확인하세요'); }
    setTesting(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('삭제할까요?')) return;
    await supabase.from('webhook_configs').delete().eq('id', id);
    reload();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        <input type="text" placeholder="스페이스 이름" value={form.space_name} onChange={e => setForm(f => ({ ...f, space_name: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-36 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        <select value={form.target_platform} onChange={e => setForm(f => ({ ...f, target_platform: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          {['AOS','iOS','SERVER','QA_ALL'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="text" placeholder="Webhook URL" value={form.webhook_url} onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[200px] focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        <button onClick={handleAdd} className="flex items-center gap-1 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-700">
          <Plus size={14}/> 추가
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {['스페이스','플랫폼','Webhook URL','상태','',''].map(h => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {webhooks.map(wh => (
            <tr key={wh.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-medium">{wh.space_name}</td>
              <td className="px-3 py-2"><span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{wh.target_platform}</span></td>
              <td className="px-3 py-2 text-xs text-gray-500 max-w-xs truncate">{wh.webhook_url}</td>
              <td className="px-3 py-2 text-xs">{wh.is_active ? '활성' : '비활성'}</td>
              <td className="px-3 py-2">
                <button onClick={() => handleTest(wh)} disabled={testing === wh.id}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline disabled:opacity-50">
                  <TestTube size={12}/> {testing === wh.id ? '전송중...' : '테스트'}
                </button>
              </td>
              <td className="px-3 py-2">
                <button onClick={() => handleDelete(wh.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
