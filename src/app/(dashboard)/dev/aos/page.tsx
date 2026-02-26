'use client';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import DataTable from '@/components/table/DataTable';
import { StatusBadge, PriorityTag } from '@/components/common/StatusBadge';
import { Send, Plus, X } from 'lucide-react';
import type { DevItem, Developer, DevStatus, FixStatus, Priority } from '@/lib/types/database';
const PLATFORM = 'AOS';
export default function AosPage() {
  const supabase = createClient();
  const [devItems, setDevItems] = useState<DevItem[]>([]);
  const [bugItems, setBugItems] = useState<any[]>([]);
  const [commonBugs, setCommonBugs] = useState<any[]>([]);
  const [serverBugs, setServerBugs] = useState<any[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'dev'|'bug'|'common'|'server'>('dev');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  const loadData = useCallback(async () => {
    setLoading(true);
    const [d,b,c,s,devs] = await Promise.all([
      supabase.from('dev_items').select('*, developers(name)').eq('platform',PLATFORM).order('created_at',{ascending:false}),
      supabase.from('bug_items').select('*, developers(name)').eq('platform',PLATFORM).order('created_at',{ascending:false}),
      supabase.from('common_bugs').select('*, developers(name)').order('created_at',{ascending:false}),
      supabase.from('server_bugs').select('*, developers(name)').order('created_at',{ascending:false}),
      supabase.from('developers').select('*').eq('is_active',true),
    ]);
    setDevItems(d.data||[]); setBugItems(b.data||[]); setCommonBugs(c.data||[]); setServerBugs(s.data||[]);
    setDevelopers(devs.data||[]); setLoading(false);
  },[]);
  useEffect(()=>{loadData();},[loadData]);
  const sections = [
    {key:'dev' as const,label:'개발항목',count:devItems.length,bg:'bg-blue-600'},
    {key:'bug' as const,label:'앱 오류',count:bugItems.length,bg:'bg-red-500'},
    {key:'common' as const,label:'공통 오류',count:commonBugs.length,bg:'bg-orange-500'},
    {key:'server' as const,label:'서버 오류',count:serverBugs.length,bg:'bg-purple-500'},
  ];
  const devCols = [
    {key:'version',label:'버전',width:'w-20',sortable:true},
    {key:'menu_item',label:'항목',sortable:true,render:(i:any)=><button onClick={()=>{setEditId(i.id);setShowForm(true);}} className="text-blue-600 hover:underline font-medium text-left">{i.menu_item}</button>},
    {key:'description',label:'상세설명',width:'max-w-xs',render:(i:any)=><span className="text-gray-500 text-xs line-clamp-2">{i.description||'-'}</span>},
    {key:'is_required',label:'필수',width:'w-14',render:(i:any)=>i.is_required?<span className="text-xs font-medium text-blue-600">필수</span>:<span className="text-xs text-gray-400">-</span>},
    {key:'department',label:'부서',width:'w-20',sortable:true},
    {key:'requester',label:'담당자',width:'w-20'},
    {key:'developer',label:'개발담당',width:'w-20',render:(i:any)=>i.developers?.name||<span className="text-gray-300">미배정</span>},
    {key:'dev_status',label:'개발결과',width:'w-24',sortable:true,render:(i:any)=><StatusBadge status={i.dev_status} type="dev"/>},
    {key:'send_status',label:'전송',width:'w-20',render:(i:any)=><StatusBadge status={i.send_status} type="send"/>},
  ];
  const bugCols = [
    {key:'version',label:'버전',width:'w-20',sortable:true},
    {key:'priority',label:'우선순위',width:'w-20',sortable:true,render:(i:any)=><PriorityTag priority={i.priority}/>},
    {key:'location',label:'이슈 위치',sortable:true,render:(i:any)=><button onClick={()=>{setEditId(i.id);setShowForm(true);}} className="text-blue-600 hover:underline font-medium text-left">{i.location}</button>},
    {key:'description',label:'상세설명',width:'max-w-xs',render:(i:any)=><span className="text-gray-500 text-xs line-clamp-2">{i.description||'-'}</span>},
    {key:'reporter',label:'보고자',width:'w-20'},
    {key:'developer',label:'개발담당',width:'w-20',render:(i:any)=>i.developers?.name||<span className="text-gray-300">미배정</span>},
    {key:'fix_status',label:'수정결과',width:'w-24',sortable:true,render:(i:any)=><StatusBadge status={i.fix_status} type="fix"/>},
    {key:'send_status',label:'전송',width:'w-20',render:(i:any)=><StatusBadge status={i.send_status} type="send"/>},
  ];
  const curData = activeSection==='dev'?devItems:activeSection==='bug'?bugItems:activeSection==='common'?commonBugs:serverBugs;
  const curCols = activeSection==='dev'?devCols:bugCols;
  const curTable = activeSection==='dev'?'dev_items':activeSection==='bug'?'bug_items':activeSection==='common'?'common_bugs':'server_bugs';
  const handleSend = async()=>{
    if(selectedIds.size===0)return;
    if(!confirm(`${selectedIds.size}건을 전송할까요?`))return;
    const ep = activeSection==='dev'?'/api/send/dev-items':'/api/send/bug-items';
    await fetch(ep,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({itemIds:Array.from(selectedIds),platform:PLATFORM})});
    alert('전송 완료!'); setSelectedIds(new Set()); loadData();
  };
  const openAdd=()=>{setEditId(null);setShowForm(true);};
  const closeForm=()=>{setShowForm(false);setEditId(null);};
  const afterSave=()=>{closeForm();loadData();};
  const handleDel=async()=>{if(!editId||!confirm('삭제?'))return;await supabase.from(curTable).delete().eq('id',editId);afterSave();};
  return (<div>
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-xl font-bold text-gray-900">AOS</h1>
      <button onClick={openAdd} className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700"><Plus size={16}/>{activeSection==='dev'?'항목 추가':'오류 추가'}</button>
    </div>
    <div className="flex gap-2 mb-4 flex-wrap">
      {sections.map(s=>(<button key={s.key} onClick={()=>{setActiveSection(s.key);setSelectedIds(new Set());}}
        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${activeSection===s.key?s.bg+' text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
        {s.label} <span className="ml-1 opacity-70">({s.count})</span></button>))}
    </div>
    <DataTable data={curData as any[]} columns={curCols as any} selectable selectedIds={selectedIds} onSelectionChange={setSelectedIds}
      searchKeys={activeSection==='dev'?['menu_item','description','department']:['location','description','reporter']}
      searchPlaceholder="검색..." emptyMessage={loading?'로딩 중...':'데이터 없음'}
      toolbar={<button onClick={handleSend} disabled={selectedIds.size===0} className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-40"><Send size={13}/>선택 전송{selectedIds.size>0&&` (${selectedIds.size})`}</button>}/>
    {showForm&&(activeSection==='dev'?
      <DevForm supabase={supabase} devs={developers} editId={editId} platform={PLATFORM} onClose={closeForm} onSaved={afterSave} onDel={handleDel}/>:
      <BugForm supabase={supabase} devs={developers} editId={editId} table={curTable} defPlatform={activeSection==='bug'?PLATFORM:undefined} onClose={closeForm} onSaved={afterSave} onDel={handleDel}/>
    )}
  </div>);
}
function DevForm({supabase,devs,editId,platform,onClose,onSaved,onDel}:any){
  const [f,sf]=useState({version:'',menu_item:'',description:'',is_required:false,department:'',requester:'',developer_id:'',dev_status:'대기' as DevStatus,note:''});
  const [saving,setSaving]=useState(false);
  useEffect(()=>{if(editId)supabase.from('dev_items').select('*').eq('id',editId).single().then(({data}:any)=>{if(data)sf({version:data.version||'',menu_item:data.menu_item||'',description:data.description||'',is_required:data.is_required||false,department:data.department||'',requester:data.requester||'',developer_id:data.developer_id||'',dev_status:data.dev_status||'대기',note:data.note||''});});},[editId]);
  const save=async()=>{if(!f.menu_item.trim()){alert('항목명 입력');return;}setSaving(true);const p={...f,platform,developer_id:f.developer_id||null};if(editId)await supabase.from('dev_items').update(p).eq('id',editId);else await supabase.from('dev_items').insert(p);setSaving(false);onSaved();};
  return(<Modal title={editId?'항목 수정':'새 항목 추가'} onClose={onClose}><div className="p-6 space-y-4">
    <div className="grid grid-cols-2 gap-4"><Inp l="버전" v={f.version} c={v=>sf(p=>({...p,version:v}))} ph="V51.0.3"/><Inp l="항목명 *" v={f.menu_item} c={v=>sf(p=>({...p,menu_item:v}))}/></div>
    <Inp l="상세설명" v={f.description} c={v=>sf(p=>({...p,description:v}))} multi/>
    <div className="grid grid-cols-2 gap-4"><Inp l="부서" v={f.department} c={v=>sf(p=>({...p,department:v}))}/><Inp l="담당자" v={f.requester} c={v=>sf(p=>({...p,requester:v}))}/></div>
    <div className="grid grid-cols-2 gap-4">
      <Sel l="개발담당" v={f.developer_id} c={v=>sf(p=>({...p,developer_id:v}))} opts={[{v:'',l:'미배정'},...devs.map((d:any)=>({v:d.id,l:d.name}))]}/>
      <Sel l="개발결과" v={f.dev_status} c={v=>sf(p=>({...p,dev_status:v as DevStatus}))} opts={['대기','개발중','개발완료','검수요청','보류'].map(s=>({v:s,l:s}))}/>
    </div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_required} onChange={e=>sf(p=>({...p,is_required:e.target.checked}))} className="rounded"/>필수</label>
    <Inp l="비고" v={f.note} c={v=>sf(p=>({...p,note:v}))} multi/>
  </div><Foot editId={editId} onDel={onDel} onClose={onClose} onSave={save} saving={saving}/></Modal>);
}
function BugForm({supabase,devs,editId,table,defPlatform,onClose,onSaved,onDel}:any){
  const [f,sf]=useState({platform:defPlatform||'AOS',version:'',location:'',description:'',priority:'보통' as Priority,department:'',reporter:'',developer_id:'',fix_status:'미수정' as FixStatus,note:''});
  const [saving,setSaving]=useState(false);
  useEffect(()=>{if(editId)supabase.from(table).select('*').eq('id',editId).single().then(({data}:any)=>{if(data)sf({platform:data.platform||defPlatform||'AOS',version:data.version||'',location:data.location||'',description:data.description||'',priority:data.priority||'보통',department:data.department||'',reporter:data.reporter||'',developer_id:data.developer_id||'',fix_status:data.fix_status||'미수정',note:data.note||''});});},[editId]);
  const save=async()=>{if(!f.location.trim()){alert('위치 입력');return;}setSaving(true);const p:any={...f,developer_id:f.developer_id||null};if(table==='common_bugs'||table==='server_bugs')delete p.platform;if(editId)await supabase.from(table).update(p).eq('id',editId);else await supabase.from(table).insert(p);setSaving(false);onSaved();};
  return(<Modal title={editId?'오류 수정':'새 오류 추가'} onClose={onClose}><div className="p-6 space-y-4">
    <div className="grid grid-cols-2 gap-4">
      {defPlatform?<Inp l="플랫폼" v={defPlatform} c={()=>{}}/>:<Sel l="플랫폼" v={f.platform} c={v=>sf(p=>({...p,platform:v}))} opts={[{v:'AOS',l:'AOS'},{v:'iOS',l:'iOS'}]}/>}
      <Inp l="버전" v={f.version} c={v=>sf(p=>({...p,version:v}))} ph="V51.0.3"/>
    </div>
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
  </div><Foot editId={editId} onDel={onDel} onClose={onClose} onSave={save} saving={saving}/></Modal>);
}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){return(
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
    <div className="flex items-center justify-between px-6 py-4 border-b"><h2 className="font-bold">{title}</h2><button onClick={onClose}><X size={18}/></button></div>{children}</div></div>);}
function Foot({editId,onDel,onClose,onSave,saving}:any){return(
  <div className="flex justify-between px-6 py-4 border-t">{editId?<button onClick={onDel} className="text-red-500 text-sm">삭제</button>:<div/>}
    <div className="flex gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">취소</button><button onClick={onSave} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">{saving?'저장중...':editId?'수정':'추가'}</button></div></div>);}
function Inp({l,v,c,ph,multi}:{l:string;v:string;c:(v:string)=>void;ph?:string;multi?:boolean}){
  const cls="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  return(<div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>{multi?<textarea value={v} onChange={e=>c(e.target.value)} placeholder={ph} rows={3} className={cls}/>:<input type="text" value={v} onChange={e=>c(e.target.value)} placeholder={ph} className={cls}/>}</div>);}
function Sel({l,v,c,opts}:{l:string;v:string;c:(v:string)=>void;opts:{v:string;l:string}[]}){return(
  <div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label><select value={v} onChange={e=>c(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">{opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></div>);}
