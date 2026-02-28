'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import DataTable from '@/components/table/DataTable';
import { StatusBadge, PriorityTag } from '@/components/common/StatusBadge';
import { Plus, Send, X } from 'lucide-react';
import { useVersion } from '@/components/layout/Header';
import type { Priority, FixStatus, ReviewStatus } from '@/lib/types/database';

export default function ServerBugsPage() {
  const supabase = createClient();
  const { aosVersions, iosVersions, aosVersion, iosVersion, userName, userDept } = useVersion();
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
  const devTeam = useMemo(()=>devs.filter(d=>['개발팀','서버(백앤드)','서버(시스템)'].includes(d.department)),[devs]);
  const allVers = Array.from(new Set(aosVersions.map(v=>v.version).concat(iosVersions.map(v=>v.version))));
  const defaultVer = aosVersion || iosVersion || allVers[0] || '';
  const closeForm=()=>setShowForm(null);
  const afterSave=()=>{closeForm();load();};
  const handleDel=async(id:string)=>{if(!confirm('삭제?'))return;await supabase.from('server_bugs').delete().eq('id',id);afterSave();};

  const handleReviewChange = async(id:string, val:ReviewStatus) => {
    await supabase.from('server_bugs').update({review_status:val}).eq('id',id);
    load();
  };
  const ReviewSel = ({item}:{item:any}) => {
    
    return(<select value={item.review_status||'검수전'} onChange={e=>handleReviewChange(item.id,e.target.value as ReviewStatus)}
      className="text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-blue-400" onClick={e=>e.stopPropagation()}>
      <option value="검수전">검수전</option><option value="검수중">검수중</option><option value="검수완료">검수완료</option>
    </select>);
  };
  const isReviewed = (item:any) => item.fix_status==='수정완료' && item.review_status==='검수완료';

  const cols = [
    {key:'version',label:'버전',width:'w-20',sortable:true},
    {key:'priority',label:'우선순위',width:'w-20',sortable:true,render:(i:any)=><PriorityTag priority={i.priority}/>},
    {key:'location',label:'위치',sortable:true,render:(i:any)=><button onClick={()=>setShowForm({id:i.id})} className={`text-blue-600 hover:underline font-medium text-left ${isReviewed(i)?'line-through text-gray-400':''}`}>{i.location}</button>},
    {key:'description',label:'설명',width:'max-w-xs',render:(i:any)=><span className={`text-gray-500 text-xs line-clamp-1 ${isReviewed(i)?'line-through':''}`}>{i.description||'-'}</span>},
    {key:'developer',label:'개발담당',width:'w-20',render:(i:any)=>i.developers?.name||<span className="text-gray-300">-</span>},
    {key:'fix_status',label:'수정결과',width:'w-24',sortable:true,render:(i:any)=><StatusBadge status={i.fix_status} type="fix"/>},
    {key:'review_status',label:'검수',width:'w-24',render:(i:any)=><ReviewSel item={i}/>},
    {key:'send_status',label:'전송',width:'w-20',render:(i:any)=><StatusBadge status={i.send_status} type="send"/>},
  ];
  return(<div className="space-y-4">
    <div className="flex items-center justify-between">
      <div><h1 className="text-xl font-bold text-gray-900">서버 오류</h1><p className="text-xs text-gray-500 mt-0.5">AOS + iOS 양쪽 서버 오류</p></div>
      <button onClick={()=>setShowForm({})} className="flex items-center gap-1.5 bg-purple-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-purple-700"><Plus size={16}/>오류 추가</button>
    </div>
    <DataTable data={items} columns={cols} selectable selectedIds={selected} onSelectionChange={setSelected}
      searchKeys={['location','description','reporter']} searchPlaceholder="서버 오류 검색..." emptyMessage={loading?'로딩 중...':'없음'}
      toolbar={selected.size>0?<button className="flex items-center gap-1 bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg"><Send size={12}/>선택 전송 ({selected.size})</button>:undefined}/>
    {showForm&&<BugModal supabase={supabase} devTeam={devTeam} editId={showForm.id} table="server_bugs" title="서버 오류" versionList={allVers} defaultVer={defaultVer} userName={userName} userDept={userDept} onClose={closeForm} onSaved={afterSave} onDel={handleDel}/>}
  </div>);
}
function BugModal({supabase,devTeam,editId,table,title,versionList,defaultVer,userName,userDept,onClose,onSaved,onDel}:any){
  const [f,sf]=useState({version:defaultVer||versionList[0]||'',location:'',description:'',priority:'보통' as Priority,department:userDept||'',reporter:userName||'',developer_id:'',fix_status:'미수정' as FixStatus,review_status:'검수전' as ReviewStatus,note:''});
  const [saving,ss]=useState(false);
  useEffect(()=>{if(!editId)sf(p=>({...p,reporter:p.reporter||userName,department:p.department||userDept}));},[userName,userDept,editId]);
  useEffect(()=>{if(editId)supabase.from(table).select('*').eq('id',editId).single().then(({data}:any)=>{if(data)sf({version:data.version||'',location:data.location||'',description:data.description||'',priority:data.priority||'보통',department:data.department||'',reporter:data.reporter||'',developer_id:data.developer_id||'',fix_status:data.fix_status||'미수정',review_status:data.review_status||'검수전',note:data.note||''});});},[editId]);
  const save=async()=>{if(!f.location.trim()){alert('위치 필수');return;}ss(true);const p={...f,developer_id:f.developer_id||null};if(editId)await supabase.from(table).update(p).eq('id',editId);else await supabase.from(table).insert(p);ss(false);onSaved();};
  return(<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}><div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
    <div className="flex items-center justify-between px-6 py-4 border-b"><h2 className="font-bold text-lg">{editId?`${title} 수정`:`${title} 추가`}</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button></div>
    <div className="p-6 space-y-4">
      <VerSel l="버전" v={f.version} c={v=>sf(p=>({...p,version:v}))} versions={versionList} defaultVer={defaultVer}/>
      <Inp l="이슈 위치 *" v={f.location} c={v=>sf(p=>({...p,location:v}))}/>
      <Inp l="상세설명" v={f.description} c={v=>sf(p=>({...p,description:v}))} multi/>
      <div className="grid grid-cols-2 gap-4"><Sel l="우선순위" v={f.priority} c={v=>sf(p=>({...p,priority:v as Priority}))} opts={['긴급','높음','보통','낮음'].map(s=>({v:s,l:s}))}/><Inp l="보고자" v={f.reporter} c={v=>sf(p=>({...p,reporter:v}))}/></div>
      <div className="grid grid-cols-2 gap-4"><Inp l="부서" v={f.department} c={v=>sf(p=>({...p,department:v}))} disabled/><DevSel l="개발담당" v={f.developer_id} c={v=>sf(p=>({...p,developer_id:v}))} devs={devTeam}/></div>
      <Sel l="수정결과" v={f.fix_status} c={v=>sf(p=>({...p,fix_status:v as FixStatus}))} opts={['미수정','수정중','수정완료','보류'].map(s=>({v:s,l:s}))}/>
      <Sel l="검수상태" v={f.review_status} c={v=>sf(p=>({...p,review_status:v as ReviewStatus}))} opts={['검수전','검수중','검수완료'].map(s=>({v:s,l:s}))}/>
      <Inp l="비고" v={f.note} c={v=>sf(p=>({...p,note:v}))} multi/>
    </div>
    <div className="flex justify-between px-6 py-4 border-t bg-gray-50">{editId?<button onClick={()=>onDel(editId)} className="text-red-500 text-sm font-medium">삭제</button>:<div/>}<div className="flex gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg">취소</button><button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">{saving?'저장중...':editId?'수정':'추가'}</button></div></div>
  </div></div>);
}
function Inp({l,v,c,ph,multi,disabled}:{l:string;v:string;c:(v:string)=>void;ph?:string;multi?:boolean;disabled?:boolean}){const cls="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500";return(<div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>{multi?<textarea value={v} onChange={e=>c(e.target.value)} placeholder={ph} rows={3} className={cls} disabled={disabled}/>:<input type="text" value={v} onChange={e=>c(e.target.value)} placeholder={ph} className={cls} disabled={disabled}/>}</div>);}
function Sel({l,v,c,opts}:{l:string;v:string;c:(v:string)=>void;opts:{v:string;l:string}[]}){return(<div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label><select value={v} onChange={e=>c(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">{opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></div>);}
function VerSel({l,v,c,versions,defaultVer}:{l:string;v:string;c:(v:string)=>void;versions:string[];defaultVer?:string}){
  const mainVer = defaultVer || versions[0] || '';
  const otherVers = versions.filter(ver=>ver!==mainVer);
  return(<div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
    <select value={v} onChange={e=>c(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
      {mainVer && <option value={mainVer}>{mainVer} (현재)</option>}
      {v && v!==mainVer && !versions.includes(v) && <option value={v}>{v}</option>}
      {otherVers.length>0 && <option disabled>── 다른 버전 ──</option>}
      {otherVers.map(ver=><option key={ver} value={ver}>{ver}</option>)}
    </select></div>);}
function DevSel({l,v,c,devs}:{l:string;v:string;c:(v:string)=>void;devs:any[]}){
  const groups:{label:string;key:string;items:any[]}[]=[
    {label:'AOS',key:'AOS',items:devs.filter(d=>d.department==='개발팀'&&d.platform==='AOS'&&d.name!=='구광완')},
    {label:'iOS',key:'iOS',items:devs.filter(d=>d.department==='개발팀'&&d.platform==='iOS')},
    {label:'서버',key:'서버',items:devs.filter(d=>d.department.startsWith('서버')&&d.name!=='김주성')},
  ].filter(g=>g.items.length>0);
  return(<div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
    <select value={v} onChange={e=>c(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
      <option value="">미배정</option>
      {groups.map(g=>(<optgroup key={g.label} label={`── ${g.label} ──`}>
        {g.items.map(d=><option key={d.id} value={d.id}>{d.name} ({d.role})</option>)}
      </optgroup>))}
    </select></div>);}
