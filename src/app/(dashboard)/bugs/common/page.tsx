'use client';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import DataTable from '@/components/table/DataTable';
import { StatusBadge, PriorityTag } from '@/components/common/StatusBadge';
import { Plus, Send, X } from 'lucide-react';
import type { CommonBug, Developer, Priority, FixStatus } from '@/lib/types/database';
export default function CommonBugsPage() {
  const supabase = createClient();
  const [items, setItems] = useState<CommonBug[]>([]);
  const [devs, setDevs] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const load = useCallback(async () => {
    const [i,d] = await Promise.all([
      supabase.from('common_bugs').select('*, developers(name)').order('created_at',{ascending:false}),
      supabase.from('developers').select('*').eq('is_active',true),
    ]);
    setItems(i.data||[]); setDevs(d.data||[]); setLoading(false);
  },[]);
  useEffect(()=>{load();},[load]);
  const cols = [
    {key:'version',label:'버전',width:'w-20',sortable:true},
    {key:'priority',label:'우선순위',width:'w-20',sortable:true,render:(i:any)=><PriorityTag priority={i.priority}/>},
    {key:'location',label:'이슈 위치',sortable:true,render:(i:any)=><button onClick={()=>{setEditId(i.id);setShowForm(true);}} className="text-blue-600 hover:underline font-medium text-left">{i.location}</button>},
    {key:'description',label:'상세설명',width:'max-w-xs',render:(i:any)=><span className="text-gray-500 text-xs line-clamp-2">{i.description||'-'}</span>},
    {key:'reporter',label:'보고자',width:'w-20'},
    {key:'developer',label:'개발담당',width:'w-20',render:(i:any)=>i.developers?.name||<span className="text-gray-300">미배정</span>},
    {key:'fix_status',label:'수정결과',width:'w-24',sortable:true,render:(i:any)=><StatusBadge status={i.fix_status} type="fix"/>},
    {key:'send_status',label:'전송',width:'w-20',render:(i:any)=><StatusBadge status={i.send_status} type="send"/>},
  ];
  const close=()=>{setShowForm(false);setEditId(null);};
  const after=()=>{close();load();};
  const del=async()=>{if(!editId||!confirm('삭제?'))return;await supabase.from('common_bugs').delete().eq('id',editId);after();};
  return(<div>
    <div className="flex items-center justify-between mb-4">
      <div><h1 className="text-xl font-bold text-gray-900">공통 오류</h1><p className="text-xs text-gray-500 mt-1">AOS + iOS 양쪽 공통 오류</p></div>
      <button onClick={()=>{setEditId(null);setShowForm(true);}} className="flex items-center gap-1.5 bg-orange-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-orange-700"><Plus size={16}/>오류 추가</button>
    </div>
    <DataTable data={items} columns={cols} selectable selectedIds={selectedIds} onSelectionChange={setSelectedIds}
      searchKeys={['location','description','reporter']} searchPlaceholder="검색..." emptyMessage={loading?'로딩 중...':'데이터 없음'}
      toolbar={<button disabled={selectedIds.size===0} className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-40"><Send size={13}/>선택 전송{selectedIds.size>0&&` (${selectedIds.size})`}</button>}/>
    {(showForm||editId)&&<BugModal supabase={supabase} devs={devs} editId={editId} table="common_bugs" onClose={close} onSaved={after} onDel={del}/>}
  </div>);
}
function BugModal({supabase,devs,editId,table,onClose,onSaved,onDel}:any){
  const [f,sf]=useState({version:'',location:'',description:'',priority:'보통' as Priority,department:'',reporter:'',developer_id:'',fix_status:'미수정' as FixStatus,note:''});
  const [saving,setSaving]=useState(false);
  useEffect(()=>{if(editId)supabase.from(table).select('*').eq('id',editId).single().then(({data}:any)=>{if(data)sf({version:data.version||'',location:data.location||'',description:data.description||'',priority:data.priority||'보통',department:data.department||'',reporter:data.reporter||'',developer_id:data.developer_id||'',fix_status:data.fix_status||'미수정',note:data.note||''});});},[editId]);
  const save=async()=>{if(!f.location.trim()){alert('위치 입력');return;}setSaving(true);const p={...f,developer_id:f.developer_id||null};if(editId)await supabase.from(table).update(p).eq('id',editId);else await supabase.from(table).insert(p);setSaving(false);onSaved();};
  return(<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
    <div className="flex items-center justify-between px-6 py-4 border-b"><h2 className="font-bold">{editId?'오류 수정':'오류 추가'}</h2><button onClick={onClose}><X size={18}/></button></div>
    <div className="p-6 space-y-4">
      <Inp l="버전" v={f.version} c={v=>sf(p=>({...p,version:v}))} ph="V51.0.3"/>
      <Inp l="이슈 위치 *" v={f.location} c={v=>sf(p=>({...p,location:v}))}/>
      <Inp l="상세설명" v={f.description} c={v=>sf(p=>({...p,description:v}))} multi/>
      <div className="grid grid-cols-2 gap-4">
        <Sel l="우선순위" v={f.priority} c={v=>sf(p=>({...p,priority:v as Priority}))} opts={['긴급','높음','보통','낮음'].map(s=>({v:s,l:s}))}/>
        <Inp l="보고자" v={f.reporter} c={v=>sf(p=>({...p,reporter:v}))}/>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Sel l="개발담당" v={f.developer_id} c={v=>sf(p=>({...p,developer_id:v}))} opts={[{v:'',l:'미배정'},...devs.map((d:any)=>({v:d.id,l:d.name}))]}/>
        <Sel l="수정결과" v={f.fix_status} c={v=>sf(p=>({...p,fix_status:v as FixStatus}))} opts={['미수정','수정중','수정완료','보류'].map(s=>({v:s,l:s}))}/>
      </div>
      <Inp l="비고" v={f.note} c={v=>sf(p=>({...p,note:v}))} multi/>
    </div>
    <div className="flex justify-between px-6 py-4 border-t">{editId?<button onClick={onDel} className="text-red-500 text-sm">삭제</button>:<div/>}<div className="flex gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">취소</button><button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">{saving?'저장중...':editId?'수정':'추가'}</button></div></div>
  </div></div>);
}
function Inp({l,v,c,ph,multi}:{l:string;v:string;c:(v:string)=>void;ph?:string;multi?:boolean}){const cls="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm";return(<div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>{multi?<textarea value={v} onChange={e=>c(e.target.value)} placeholder={ph} rows={3} className={cls}/>:<input type="text" value={v} onChange={e=>c(e.target.value)} placeholder={ph} className={cls}/>}</div>);}
function Sel({l,v,c,opts}:{l:string;v:string;c:(v:string)=>void;opts:{v:string;l:string}[]}){return(<div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label><select value={v} onChange={e=>c(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">{opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></div>);}
