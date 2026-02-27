'use client';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import DataTable from '@/components/table/DataTable';
import { StatusBadge, PriorityTag } from '@/components/common/StatusBadge';
import { Plus, Send, X } from 'lucide-react';
import { useVersion } from '@/components/layout/Header';
import type { Priority, FixStatus } from '@/lib/types/database';

export default function ServerBugsPage() {
  const supabase = createClient();
  const { aosVersions, iosVersions, userName } = useVersion();
  const [items, setItems] = useState<any[]>([]);
  const [devs, setDevs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<{id?:string}|null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const [i, d] = await Promise.all([
      supabase.from('server_bugs').select('*, developers(name)').order('created_at',{ascending:false}),
      supabase.from('developers').select('*').eq('is_active',true),
    ]);
    setItems(i.data||[]); setDevs(d.data||[]); setLoading(false);
  },[]);

  useEffect(()=>{load();},[load]);
  const closeForm=()=>setShowForm(null);
  const afterSave=()=>{closeForm();load();};
  const handleDel=async(id:string)=>{if(!confirm('삭제?'))return;await supabase.from('server_bugs').delete().eq('id',id);afterSave();};

  // 버전 목록 (AOS + iOS 합쳐서 중복 제거)
  const allVers = Array.from(new Set(aosVersions.map(v=>v.version).concat(iosVersions.map(v=>v.version))));

  const cols = [
    {key:'version',label:'버전',width:'w-20',sortable:true},
    {key:'priority',label:'우선순위',width:'w-20',sortable:true,render:(i:any)=><PriorityTag priority={i.priority}/>},
    {key:'location',label:'위치',sortable:true,render:(i:any)=><button onClick={()=>setShowForm({id:i.id})} className="text-blue-600 hover:underline font-medium text-left">{i.location}</button>},
    {key:'description',label:'설명',width:'max-w-xs',render:(i:any)=><span className="text-gray-500 text-xs line-clamp-1">{i.description||'-'}</span>},
    {key:'developer',label:'개발담당',width:'w-20',render:(i:any)=>i.developers?.name||<span className="text-gray-300">-</span>},
    {key:'fix_status',label:'상태',width:'w-24',sortable:true,render:(i:any)=><StatusBadge status={i.fix_status} type="fix"/>},
    {key:'send_status',label:'전송',width:'w-20',render:(i:any)=><StatusBadge status={i.send_status} type="send"/>},
  ];

  return(<div className="space-y-4">
    <div className="flex items-center justify-between">
      <div><h1 className="text-xl font-bold text-gray-900">서버 오류</h1><p className="text-xs text-gray-500 mt-0.5">서버 및 데이터 관련 오류</p></div>
      <button onClick={()=>setShowForm({})} className="flex items-center gap-1.5 bg-purple-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-purple-700"><Plus size={16}/>오류 추가</button>
    </div>
    <DataTable data={items} columns={cols} selectable selectedIds={selected} onSelectionChange={setSelected}
      searchKeys={['location','description','reporter']} searchPlaceholder="서버 오류 검색..." emptyMessage={loading?'로딩 중...':'등록된 오류 없음'}
      toolbar={selected.size>0?<button className="flex items-center gap-1 bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg"><Send size={12}/>선택 전송 ({selected.size})</button>:undefined}/>
    {showForm&&<BugModal supabase={supabase} devs={devs} editId={showForm.id} table="server_bugs" title="서버 오류" versionList={allVers} userName={userName} onClose={closeForm} onSaved={afterSave} onDel={handleDel}/>}
  </div>);
}

function BugModal({supabase,devs,editId,table,title,versionList,userName,onClose,onSaved,onDel}:any){
  const [f,sf]=useState({version:versionList[0]||'',location:'',description:'',priority:'보통' as Priority,department:'',reporter:userName||'',developer_id:'',fix_status:'미수정' as FixStatus,note:''});
  const [saving,ss]=useState(false);
  useEffect(()=>{if(!editId&&userName)sf(p=>({...p,reporter:p.reporter||userName}));},[userName,editId]);
  useEffect(()=>{if(editId)supabase.from(table).select('*').eq('id',editId).single().then(({data}:any)=>{if(data)sf({version:data.version||'',location:data.location||'',description:data.description||'',priority:data.priority||'보통',department:data.department||'',reporter:data.reporter||'',developer_id:data.developer_id||'',fix_status:data.fix_status||'미수정',note:data.note||''});});},[editId]);
  const save=async()=>{if(!f.location.trim()){alert('위치 필수');return;}ss(true);const p={...f,developer_id:f.developer_id||null};if(editId)await supabase.from(table).update(p).eq('id',editId);else await supabase.from(table).insert(p);ss(false);onSaved();};
  return(<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}><div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
    <div className="flex items-center justify-between px-6 py-4 border-b"><h2 className="font-bold text-lg">{editId?`${title} 수정`:`${title} 추가`}</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button></div>
    <div className="p-6 space-y-4">
      <VerSel l="버전" v={f.version} c={v=>sf(p=>({...p,version:v}))} versions={versionList}/>
      <Inp l="이슈 위치 *" v={f.location} c={v=>sf(p=>({...p,location:v}))}/>
      <Inp l="상세설명" v={f.description} c={v=>sf(p=>({...p,description:v}))} multi/>
      <div className="grid grid-cols-2 gap-4">
        <Sel l="우선순위" v={f.priority} c={v=>sf(p=>({...p,priority:v as Priority}))} opts={['긴급','높음','보통','낮음'].map(s=>({v:s,l:s}))}/>
        <Inp l="보고자" v={f.reporter} c={v=>sf(p=>({...p,reporter:v}))}/>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <DevSel l="개발담당" v={f.developer_id} c={v=>sf(p=>({...p,developer_id:v}))} devs={devs}/>
        <Sel l="수정결과" v={f.fix_status} c={v=>sf(p=>({...p,fix_status:v as FixStatus}))} opts={['미수정','수정중','수정완료','보류'].map(s=>({v:s,l:s}))}/>
      </div>
      <Inp l="비고" v={f.note} c={v=>sf(p=>({...p,note:v}))} multi/>
    </div>
    <div className="flex justify-between px-6 py-4 border-t bg-gray-50">{editId?<button onClick={()=>onDel(editId)} className="text-red-500 text-sm font-medium">삭제</button>:<div/>}<div className="flex gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg">취소</button><button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">{saving?'저장중...':editId?'수정':'추가'}</button></div></div>
  </div></div>);
}
function Inp({l,v,c,ph,multi}:{l:string;v:string;c:(v:string)=>void;ph?:string;multi?:boolean}){const cls="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm";return(<div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>{multi?<textarea value={v} onChange={e=>c(e.target.value)} placeholder={ph} rows={3} className={cls}/>:<input type="text" value={v} onChange={e=>c(e.target.value)} placeholder={ph} className={cls}/>}</div>);}
function Sel({l,v,c,opts}:{l:string;v:string;c:(v:string)=>void;opts:{v:string;l:string}[]}){return(<div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label><select value={v} onChange={e=>c(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">{opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></div>);}
function VerSel({l,v,c,versions}:{l:string;v:string;c:(v:string)=>void;versions:string[]}){return(
  <div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
    <select value={v} onChange={e=>c(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 appearance-none bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_0.75rem_center]">
      {v && !versions.includes(v) && <option value={v}>{v}</option>}
      {versions.map(ver=><option key={ver} value={ver}>{ver}</option>)}
    </select></div>);}
function DevSel({l,v,c,devs}:{l:string;v:string;c:(v:string)=>void;devs:any[]}){
  const groups: Record<string,any[]> = {};
  devs.forEach(d => { const dept = d.department || '기타'; if (!groups[dept]) groups[dept] = []; groups[dept].push(d); });
  const order = ['개발팀','AIAE','운영','서버(백앤드)','서버(시스템)','중계','기획팀','데이터/광고','재무'];
  const sorted = order.filter(k => groups[k]).concat(Object.keys(groups).filter(k => !order.includes(k)));
  return(<div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
    <select value={v} onChange={e=>c(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
      <option value="">미배정</option>
      {sorted.map(dept=>(<optgroup key={dept} label={`── ${dept} ──`}>{groups[dept].map((d:any)=><option key={d.id} value={d.id}>{d.name} ({d.role})</option>)}</optgroup>))}
    </select></div>);}
