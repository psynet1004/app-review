'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { LogOut, User, ChevronDown, Plus, Trash2 } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { AppVersion } from '@/lib/types/database';

export const VersionContext = createContext<{
  aosVersion: string; iosVersion: string;
  setAosVersion: (v: string) => void; setIosVersion: (v: string) => void;
  aosVersions: AppVersion[]; iosVersions: AppVersion[];
  refreshVersions: () => void;
}>({ aosVersion:'', iosVersion:'', setAosVersion:()=>{}, setIosVersion:()=>{}, aosVersions:[], iosVersions:[], refreshVersions:()=>{} });

export function useVersion() { return useContext(VersionContext); }

export default function Header() {
  const [user, setUser] = useState<SupabaseUser|null>(null);
  const supabase = createClient();
  const ctx = useVersion();

  useEffect(()=>{ supabase.auth.getUser().then(({data})=>setUser(data.user)); },[]);

  const handleLogout = async()=>{ await supabase.auth.signOut(); window.location.href='/login'; };

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <VersionDropdown label="AOS" versions={ctx.aosVersions} selected={ctx.aosVersion} onSelect={ctx.setAosVersion} color="green" refresh={ctx.refreshVersions} />
        <VersionDropdown label="iOS" versions={ctx.iosVersions} selected={ctx.iosVersion} onSelect={ctx.setIosVersion} color="blue" refresh={ctx.refreshVersions} />
      </div>
      <div className="flex items-center gap-3">
        {user&&(<div className="flex items-center gap-2 text-sm text-gray-600">
          <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
            {user.user_metadata?.avatar_url?<img src={user.user_metadata.avatar_url} alt="" className="w-7 h-7 rounded-full"/>:<User size={14}/>}
          </div>
          <span className="hidden sm:inline">{user.user_metadata?.full_name||user.email}</span>
        </div>)}
        <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="로그아웃"><LogOut size={16}/></button>
      </div>
    </header>
  );
}

function VersionDropdown({label,versions,selected,onSelect,color,refresh}:{
  label:string;versions:AppVersion[];selected:string;onSelect:(v:string)=>void;color:'green'|'blue';refresh:()=>void;
}) {
  const [open,setOpen]=useState(false);
  const [newVer,setNewVer]=useState('');
  const supabase=createClient();

  const cc=color==='green'
    ?{bg:'bg-green-50 border-green-200',text:'text-green-700',dot:'bg-green-500',activeBg:'bg-green-100'}
    :{bg:'bg-blue-50 border-blue-200',text:'text-blue-700',dot:'bg-blue-500',activeBg:'bg-blue-100'};

  const platform=label as 'AOS'|'iOS';

  const handleAdd=async()=>{
    if(!newVer.trim())return;
    await supabase.from('app_versions').insert({platform,version:newVer.trim(),is_current:false});
    setNewVer('');
    refresh();
  };

  const handleDelete=async(e:React.MouseEvent,id:string)=>{
    e.stopPropagation();
    if(!confirm('이 버전을 삭제할까요?'))return;
    await supabase.from('app_versions').delete().eq('id',id);
    refresh();
  };

  const toggleComplete=async(e:React.MouseEvent,v:AppVersion)=>{
    e.stopPropagation();
    await supabase.from('app_versions').update({is_current:!v.is_current}).eq('id',v.id);
    refresh();
  };

  const selectVersion=(ver:string)=>{
    onSelect(ver);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button onClick={()=>setOpen(!open)}
        className={`flex items-center gap-1.5 text-xs border ${cc.bg} ${cc.text} px-3 py-1.5 rounded-full font-medium hover:opacity-80 transition`}>
        <span className={`w-2 h-2 rounded-full ${cc.dot}`}/>
        {label} {selected||'미설정'}
        <ChevronDown size={12} className={`transition ${open?'rotate-180':''}`}/>
      </button>
      {open&&(<>
        <div className="fixed inset-0 z-20" onClick={()=>setOpen(false)}/>
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 min-w-[240px] py-1 overflow-hidden">
          <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">{label} 버전</div>
          <div className="max-h-60 overflow-y-auto">
            {versions.map(v=>(
              <div key={v.id} onClick={()=>selectVersion(v.version)}
                className={`flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer group transition ${v.version===selected?cc.activeBg:''}`}>
                <div className="flex items-center gap-2.5">
                  {v.version===selected
                    ?<span className={`w-2 h-2 rounded-full ${cc.dot}`}/>
                    :<span className="w-2 h-2 rounded-full bg-gray-200"/>}
                  <span className={v.version===selected?'font-bold text-gray-900':'text-gray-700'}>{v.version}</span>
                  {v.is_current&&<span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-bold">🔴 완료</span>}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={(e)=>toggleComplete(e,v)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-500" title={v.is_current?'완료 해제':'완료 처리'}>
                    {v.is_current?'해제':'완료'}
                  </button>
                  <button onClick={(e)=>handleDelete(e,v.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13}/></button>
                </div>
              </div>
            ))}
          </div>
          {versions.length===0&&<div className="px-4 py-3 text-xs text-gray-400 text-center">버전 없음</div>}
          <div className="border-t border-gray-100 px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <input type="text" value={newVer} onChange={e=>setNewVer(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAdd()}
                placeholder="새 버전 (예: V52.0.0)" className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
              <button onClick={handleAdd} disabled={!newVer.trim()} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-30"><Plus size={14}/></button>
            </div>
          </div>
        </div>
      </>)}
    </div>
  );
}
