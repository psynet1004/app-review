'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import DataTable from '@/components/table/DataTable';
import { StatusBadge, PriorityTag } from '@/components/common/StatusBadge';
import { Send, Plus, X, ArrowRightLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useVersion } from '@/components/layout/Header';
import type { FixStatus, Priority } from '@/lib/types/database';

export default function AppBugsPage() {
  const supabase = createClient();
  const { aosVersion, iosVersion, aosVersions, iosVersions, userName } = useVersion();
  const [rawBugs, setRawBugs] = useState<any[]>([]);
  const [developers, setDevelopers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<{platform:'AOS'|'iOS';id?:string}|null>(null);
  const [collapsed, setCollapsed] = useState<Record<string,boolean>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    const [b, d] = await Promise.all([
      supabase.from('bug_items').select('*, developers(name)').order('created_at',{ascending:false}),
      supabase.from('developers').select('*').eq('is_active',true),
    ]);
    setRawBugs(b.data||[]); setDevelopers(d.data||[]); setLoading(false);
  },[]);

  useEffect(()=>{loadData();},[loadData]);

  const filterVer = (items:any[], ver:string, verList:any[]) => {
    if(!ver) return items;
    const thisV = items.filter(i=>i.version===ver);
    const vl = verList.map(v=>v.version);
    const ci = vl.indexOf(ver);
    const older = ci>=0?vl.slice(ci+1):[];
    const carried = items.filter(i=>older.includes(i.version)&&['미수정','수정중','보류'].includes(i.fix_status))
      .map(i=>({...i,_carried:true,_origVer:i.version}));
    return [...thisV,...carried];
  };

  const aosBugs = useMemo(()=>filterVer(rawBugs.filter(b=>b.platform==='AOS'),aosVersion,aosVersions),[rawBugs,aosVersion,aosVersions]);
  const iosBugs = useMemo(()=>filterVer(rawBugs.filter(b=>b.platform==='iOS'),iosVersion,iosVersions),[rawBugs,iosVersion,iosVersions]);

  const [selAos,setSelAos]=useState<Set<string>>(new Set());
  const [selIos,setSelIos]=useState<Set<string>>(new Set());

  const toggle=(k:string)=>setCollapsed(p=>({...p,[k]:!p[k]}));
  const closeForm=()=>setShowForm(null);
  const afterSave=()=>{closeForm();loadData();};

  const CarriedBadge=({item}:{item:any})=>item._carried?(<span className="inline-flex items-center gap-0.5 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium ml-1"><ArrowRightLeft size={9}/>{item._origVer}</span>):null;

  const makeCols=(platform:'AOS'|'iOS')=>[
    {key:'version',label:'버전',width:'w-28',sortable:true,render:(i:any)=><div className="flex items-center">{i.version}<CarriedBadge item={i}/></div>},
    {key:'priority',label:'우선순위',width:'w-20',sortable:true,render:(i:any)=><PriorityTag priority={i.priority}/>},
    {key:'location',label:'위치',sortable:true,render:(i:any)=><button onClick={()=>setShowForm({platform,id:i.id})} className="text-blue-600 hover:underline font-medium text-left">{i.location}</button>},
    {key:'description',label:'설명',width:'max-w-xs',render:(i:any)=><span className="text-gray-500 text-xs line-clamp-1">{i.description||'-'}</span>},
    {key:'developer',label:'개발담당',width:'w-20',render:(i:any)=>i.developers?.name||<span className="text-gray-300">-</span>},
    {key:'fix_status',label:'상태',width:'w-24',sortable:true,render:(i:any)=><StatusBadge status={i.fix_status} type="fix"/>},
    {key:'send_status',label:'전송',width:'w-20',render:(i:any)=><StatusBadge status={i.send_status} type="send"/>},
  ];

  const handleDel=async(id:string)=>{if(!confirm('삭제?'))return;await supabase.from('bug_items').delete().eq('id',id);afterSave();};

  const SectionHeader=({title,count,color,sectionKey,onAdd}:{title:string;count:number;color:string;sectionKey:string;onAdd:()=>void})=>(
    <div className={`flex items-center justify-between py-3 px-4 ${color} rounded-t-xl cursor-pointer select-none`} onClick={()=>toggle(sectionKey)}>
      <div className="flex items-center gap-2">
        {collapsed[sectionKey]?<ChevronDown size={16} className="text-white/70"/>:<ChevronUp size={16} className="text-white/70"/>}
        <h2 className="text-sm font-bold text-white">{title}</h2>
        <span className="text-xs text-white/70 bg-white/20 px-2 py-0.5 rounded-full">{count}건</span>
      </div>
      <button onClick={e=>{e.stopPropagation();onAdd();}} className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-lg">+ 추가</button>
    </div>
  );

  const getVersionList=(p:'AOS'|'iOS')=>(p==='AOS'?aosVersions:iosVersions).map(v=>v.version);

  return(<div className="space-y-6">
    <div><h1 className="text-xl font-bold text-gray-900">앱 오류</h1><p className="text-xs text-gray-500 mt-0.5">AOS / iOS 앱 오류만 표시</p></div>

    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <SectionHeader title="📱 AOS 앱 오류" count={aosBugs.length} color="bg-green-600" sectionKey="aos" onAdd={()=>setShowForm({platform:'AOS'})}/>
      {!collapsed.aos&&<DataTable data={aosBugs} columns={makeCols('AOS')} selectable selectedIds={selAos} onSelectionChange={setSelAos}
        searchKeys={['location','description','reporter']} searchPlaceholder="AOS 오류 검색..." emptyMessage={loading?'로딩 중...':'없음'}/>}
    </div>

    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <SectionHeader title="🍎 iOS 앱 오류" count={iosBugs.length} color="bg-blue-600" sectionKey="ios" onAdd={()=>setShowForm({platform:'iOS'})}/>
      {!collapsed.ios&&<DataTable data={iosBugs} columns={makeCols('iOS')} selectable selectedIds={selIos} onSelectionChange={setSelIos}
        searchKeys={['location','description','reporter']} searchPlaceholder="iOS 오류 검색..." emptyMessage={loading?'로딩 중...':'없음'}/>}
    </div>

    {showForm&&<BugModal supabase={supabase} devs={developers} editId={showForm.id} platform={showForm.platform}
      defaultVersion={showForm.platform==='AOS'?aosVersion:iosVersion} versionList={getVersionList(showForm.platform)} userName={userName}
      onClose={closeForm} onSaved={afterSave} onDel={handleDel}/>}
  </div>);
}

function BugModal({supabase,devs,editId,platform,defaultVersion,versionList,userName,onClose,onSaved,onDel}:any){
  const [f,sf]=useState({version:defaultVersion||'',location:'',description:'',priority:'보통' as Priority,department:'',reporter:userName||'',developer_id:'',fix_status:'미수정' as FixStatus,note:''});
  const [saving,ss]=useState(false);
  useEffect(()=>{if(!editId&&userName)sf(p=>({...p,reporter:p.reporter||userName}));},[userName,editId]);
  useEffect(()=>{if(editId)supabase.from('bug_items').select('*').eq('id',editId).single().then(({data}:any)=>{if(data)sf({version:data.version||'',location:data.location||'',description:data.description||'',priority:data.priority||'보통',department:data.department||'',reporter:data.reporter||'',developer_id:data.developer_id||'',fix_status:data.fix_status||'미수정',note:data.note||''});});},[editId]);
  const save=async()=>{if(!f.location.trim()){alert('위치 필수');return;}ss(true);const p={...f,platform,developer_id:f.developer_id||null};if(editId)await supabase.from('bug_items').update(p).eq('id',editId);else await supabase.from('bug_items').insert(p);ss(false);onSaved();};
  return(<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}><div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
    <div className="flex items-center justify-between px-6 py-4 border-b"><h2 className="font-bold text-lg">{editId?'앱 오류 수정':'앱 오류 추가'} ({platform})</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button></div>
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
function Inp({l,v,c,ph,multi,disabled}:{l:string;v:string;c:(v:string)=>void;ph?:string;multi?:boolean;disabled?:boolean}){const cls="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100";return(<div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>{multi?<textarea value={v} onChange={e=>c(e.target.value)} placeholder={ph} rows={3} className={cls} disabled={disabled}/>:<input type="text" value={v} onChange={e=>c(e.target.value)} placeholder={ph} className={cls} disabled={disabled}/>}</div>);}
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
