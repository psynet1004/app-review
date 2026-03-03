'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import DataTable from '@/components/table/DataTable';
import { StatusBadge, PriorityTag } from '@/components/common/StatusBadge';
import { Send, Plus, X, ArrowRightLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useVersion } from '@/components/layout/Header';
import type { FixStatus, Priority, ReviewStatus } from '@/lib/types/database';
import { CommentChat, CommentBadge } from '@/components/common/CommentChat';

const EXCLUDED_ROLES = ['CTO','상무이사','이사'];
const EXCLUDED_DEPTS = ['서버(시스템)','재무','데이터/광고','AIAE','운영'];

export default function AppBugsPage() {
  const supabase = createClient();
  const { aosVersion, iosVersion, aosVersions, iosVersions, userName, userDept, userEmail } = useVersion();
  const [rawBugs, setRawBugs] = useState<any[]>([]);
  const [developers, setDevelopers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<{platform:'AOS'|'iOS';id?:string}|null>(null);
  const [collapsed, setCollapsed] = useState<Record<string,boolean>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string,number>>({});
  const [commentNew, setCommentNew] = useState<Record<string,boolean>>({});
  const [showComment, setShowComment] = useState<{id:string;type:string;title:string}|null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [b, d] = await Promise.all([
      supabase.from('bug_items').select('*, developers(name)').order('created_at',{ascending:false}),
      supabase.from('developers').select('*').eq('is_active',true),
    ]);
    setRawBugs(b.data||[]); setDevelopers(d.data||[]); setLoading(false);
    // Load comment counts
    const allIds = (b.data||[]).map((i:any)=>i.id);
    if(allIds.length>0){
      const {data:counts}=await supabase.from('comments').select('item_id').in('item_id',allIds);
      const cMap:Record<string,number>={};
      (counts||[]).forEach((c:any)=>{cMap[c.item_id]=(cMap[c.item_id]||0)+1;});
      setCommentCounts(cMap);
      if(userEmail){
        const {data:reads}=await supabase.from('comment_reads').select('item_id,last_read_at').eq('user_email',userEmail).in('item_id',allIds);
        const readMap:Record<string,string>={};(reads||[]).forEach((r:any)=>{readMap[r.item_id]=r.last_read_at;});
        const {data:latest}=await supabase.from('comments').select('item_id,created_at').in('item_id',allIds).order('created_at',{ascending:false});
        const latestMap:Record<string,string>={};(latest||[]).forEach((l:any)=>{if(!latestMap[l.item_id])latestMap[l.item_id]=l.created_at;});
        const nMap:Record<string,boolean>={};allIds.forEach((id:string)=>{if(latestMap[id]&&(!readMap[id]||new Date(latestMap[id])>new Date(readMap[id])))nMap[id]=true;});
        setCommentNew(nMap);
      }
    }
  },[]);

  useEffect(()=>{loadData();},[loadData]);

  const devTeam = useMemo(()=>developers.filter(d=>
    ['개발팀','서버(백앤드)'].includes(d.department) &&
    !EXCLUDED_ROLES.includes(d.role) &&
    !EXCLUDED_DEPTS.includes(d.department)
  ),[developers]);

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

  const getDevNames = (item:any) => {
    const raw = item.developer_ids || item.developer_id || "";
    if (!raw) return <span className="text-neutral-300 dark:text-neutral-600">-</span>;
    const ids = String(raw).split(",").filter(Boolean);
    const names = ids.map((id:string) => developers.find(d=>d.id===id)?.name).filter(Boolean);
    if (names.length === 0) return item.developers?.name || <span className="text-neutral-300 dark:text-neutral-600">-</span>;
    return <span className="text-xs">{names.join(", ")}</span>;
  };

  const handleReviewChange = async(id:string, val:ReviewStatus) => {
    await supabase.from('bug_items').update({review_status:val}).eq('id',id);
    loadData();
  };
  const ReviewSel = ({item}:{item:any}) => (
    <select value={item.review_status||'검수전'} onChange={e=>handleReviewChange(item.id,e.target.value as ReviewStatus)}
      className="text-xs border border-neutral-200 dark:border-neutral-800 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-neutral-400" onClick={e=>e.stopPropagation()}>
      <option value="검수전">검수전</option><option value="검수중">검수중</option><option value="검수완료">검수완료</option>
    </select>
  );
  const isReviewed = (item:any) => item.fix_status==='수정완료' && item.review_status==='검수완료';

  const makeCols=(platform:'AOS'|'iOS')=>[
    {key:'version',label:'버전',width:'w-28',sortable:true,render:(i:any)=><div className="flex items-center">{i.version}<CarriedBadge item={i}/></div>},
    {key:'priority',label:'우선순위',width:'w-20',sortable:true,align:'center' as const,render:(i:any)=><PriorityTag priority={i.priority}/>},
    {key:'location',label:'위치',sortable:true,render:(i:any)=><button onClick={()=>setShowForm({platform,id:i.id})} className={`text-neutral-900 dark:text-white hover:underline font-medium text-left ${isReviewed(i)?'line-through decoration-red-500 text-neutral-400 dark:text-neutral-600':''}`}>{i.location}</button>},
    {key:'description',label:'설명',width:'max-w-xs',render:(i:any)=><span className={`text-neutral-500 dark:text-neutral-400 text-xs line-clamp-1 ${isReviewed(i)?'line-through decoration-red-500':''}`}>{i.description||'-'}</span>},
    {key:'developer',label:'개발담당',width:'w-24',align:'center' as const,render:(i:any)=>getDevNames(i)},
    {key:'fix_status',label:'수정결과',width:'w-24',sortable:true,align:'center' as const,render:(i:any)=><StatusBadge status={i.fix_status} type="fix"/>},
    {key:'review_status',label:'검수',width:'w-24',align:'center' as const,render:(i:any)=><ReviewSel item={i}/>},
    {key:'comments',label:'💬',width:'w-10',align:'center' as const,render:(i:any)=><CommentBadge itemId={i.id} itemType="bug_items" count={commentCounts[i.id]||0} hasNew={!!commentNew[i.id]} onClick={()=>setShowComment({id:i.id,type:'bug_items',title:i.location})}/>},
    {key:'send_status',label:'전송',width:'w-20',align:'center' as const,render:(i:any)=><StatusBadge status={i.send_status} type="send"/>},
  ];
  const handleDel=async(id:string)=>{if(!confirm('삭제?'))return;await supabase.from('bug_items').delete().eq('id',id);afterSave();};

  const handleSend = async(platform:'AOS'|'iOS', ids:Set<string>)=>{
    if(ids.size===0)return;
    if(!confirm(`${ids.size}건을 전송할까요?`))return;
    await fetch('/api/send/bug-items',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({itemIds:Array.from(ids),platform})});
    alert('전송 완료!');
    if(platform==='AOS')setSelAos(new Set()); else setSelIos(new Set());
    loadData();
  };

  const SectionHeader=({title,count,sectionKey,onAdd}:{title:string;count:number;sectionKey:string;onAdd:()=>void})=>(
    <div className="flex items-center justify-between py-3 px-4 bg-black dark:bg-neutral-800 rounded-t-md cursor-pointer select-none border-b-2 border-black dark:border-neutral-700" onClick={()=>toggle(sectionKey)}>
      <div className="flex items-center gap-2">
        {collapsed[sectionKey]?<ChevronDown size={16} className="text-white/70"/>:<ChevronUp size={16} className="text-white/70"/>}
        <h2 className="text-sm font-bold text-white">{title}</h2>
        <span className="text-xs text-white/70 bg-white/20 px-2 py-0.5 rounded-full">{count}건</span>
      </div>
      <button onClick={e=>{e.stopPropagation();onAdd();}} className="text-xs bg-white text-black font-bold px-3 py-1 rounded-md border-2 border-white hover:shadow-[2px_2px_0_0_rgba(255,255,255,0.5)] transition-all">+ 추가</button>
    </div>
  );

  const SendBar = ({ids,onSend}:{ids:Set<string>;onSend:()=>void}) => ids.size > 0 ? (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-neutral-100 dark:border-neutral-800">
      <button onClick={onSend} className="flex items-center gap-1 bg-black text-white text-xs px-3 py-1.5 rounded-md border-2 border-black font-bold hover:shadow-[2px_2px_0_0_rgba(0,0,0,0.5)] dark:bg-white dark:text-black dark:border-white">
        <Send size={12}/>선택 전송 ({ids.size})
      </button>
    </div>
  ) : null;

  const getVersionList=(p:'AOS'|'iOS')=>(p==='AOS'?aosVersions:iosVersions).map(v=>v.version);
  const getDefaultVer=(p:'AOS'|'iOS')=>p==='AOS'?aosVersion:iosVersion;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">앱 오류</h1>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">AOS / iOS 앱 오류만 표시</p>
      </div>
      <div className="rounded-lg border-2 border-black dark:border-neutral-700 shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:shadow-[3px_3px_0_0_rgba(255,255,255,0.05)] bg-white dark:bg-neutral-950 overflow-hidden">
        <SectionHeader title="📱 AOS 앱 오류" count={aosBugs.length} sectionKey="aos" onAdd={()=>setShowForm({platform:'AOS'})}/>
        {!collapsed.aos && <DataTable data={aosBugs} columns={makeCols('AOS')} selectable selectedIds={selAos} onSelectionChange={setSelAos}
          searchKeys={['location','description']} searchPlaceholder="AOS 오류 검색..." emptyMessage={loading?'로딩 중...':'없음'} noBorder
          toolbar={<SendBar ids={selAos} onSend={()=>handleSend('AOS',selAos)}/>}/>}
      </div>
      <div className="rounded-lg border-2 border-black dark:border-neutral-700 shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:shadow-[3px_3px_0_0_rgba(255,255,255,0.05)] bg-white dark:bg-neutral-950 overflow-hidden">
        <SectionHeader title="🍎 iOS 앱 오류" count={iosBugs.length} sectionKey="ios" onAdd={()=>setShowForm({platform:'iOS'})}/>
        {!collapsed.ios && <DataTable data={iosBugs} columns={makeCols('iOS')} selectable selectedIds={selIos} onSelectionChange={setSelIos}
          searchKeys={['location','description']} searchPlaceholder="iOS 오류 검색..." emptyMessage={loading?'로딩 중...':'없음'} noBorder
          toolbar={<SendBar ids={selIos} onSend={()=>handleSend('iOS',selIos)}/>}/>}
      </div>
      {showForm && <BugModal supabase={supabase} devTeam={devTeam} editId={showForm.id} platform={showForm.platform}
        defaultVersion={getDefaultVer(showForm.platform)} versionList={getVersionList(showForm.platform)}
        userName={userName} userDept={userDept} onClose={closeForm} onSaved={afterSave} onDel={handleDel}/>}
      {showComment&&<CommentChat itemId={showComment.id} itemType={showComment.type as any} itemTitle={showComment.title} onClose={()=>setShowComment(null)} onCommentAdded={loadData}/>}
    </div>
  );
}

function BugModal({supabase,devTeam,editId,platform,defaultVersion,versionList,userName,userDept,onClose,onSaved,onDel}:any){
  const [f,sf]=useState({version:defaultVersion||'',location:'',description:'',priority:'보통' as Priority,department:userDept||'',reporter:userName||'',developer_ids:'',fix_status:'미수정' as FixStatus,review_status:'검수전' as ReviewStatus,note:''});
  const [saving,ss]=useState(false);
  useEffect(()=>{if(!editId)sf(p=>({...p,reporter:p.reporter||userName,department:p.department||userDept}));},[userName,userDept,editId]);
  useEffect(()=>{if(editId)supabase.from('bug_items').select('*').eq('id',editId).single().then(({data}:any)=>{if(data)sf({version:data.version||'',location:data.location||'',description:data.description||'',priority:data.priority||'보통',department:data.department||'',reporter:data.reporter||'',developer_ids:data.developer_ids||data.developer_id||'',fix_status:data.fix_status||'미수정',review_status:data.review_status||'검수전',note:data.note||''});});},[editId]);
  const save=async()=>{if(!f.location.trim()){alert('위치 필수');return;}ss(true);const p:any={...f,platform,developer_ids:f.developer_ids||null,developer_id:null};if(!editId)delete p.review_status;if(editId)await supabase.from('bug_items').update(p).eq('id',editId);else await supabase.from('bug_items').insert(p);ss(false);onSaved();};
  return(<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}><div className="bg-white dark:bg-neutral-900 rounded-lg border-2 border-black dark:border-neutral-600 shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:shadow-[6px_6px_0_0_rgba(255,255,255,0.05)] w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
    <div className="flex items-center justify-between px-6 py-4 border-b"><h2 className="font-bold text-lg">{editId?'앱 오류 수정':'앱 오류 추가'} ({platform})</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button></div>
    <div className="p-6 space-y-4">
      <VerSel l="버전" v={f.version} c={v=>sf(p=>({...p,version:v}))} versions={versionList} defaultVer={defaultVersion}/>
      <Inp l="이슈 위치 *" v={f.location} c={v=>sf(p=>({...p,location:v}))}/>
      <Inp l="상세설명" v={f.description} c={v=>sf(p=>({...p,description:v}))} multi/>
      <div className="grid grid-cols-2 gap-4"><Sel l="우선순위" v={f.priority} c={v=>sf(p=>({...p,priority:v as Priority}))} opts={['긴급','높음','보통','낮음'].map(s=>({v:s,l:s}))}/><Inp l="보고자" v={f.reporter} c={()=>{}} disabled/></div>
      <div className="grid grid-cols-2 gap-4"><Inp l="부서" v={f.department} c={()=>{}} disabled/><DevSel l="개발담당" v={f.developer_ids} c={v=>sf(p=>({...p,developer_ids:v}))} devs={devTeam}/></div>
      <Sel l="수정결과" v={f.fix_status} c={v=>sf(p=>({...p,fix_status:v as FixStatus}))} opts={['미수정','수정중','수정완료','보류'].map(s=>({v:s,l:s}))}/>
      {editId && <Sel l="검수상태" v={f.review_status} c={v=>sf(p=>({...p,review_status:v as ReviewStatus}))} opts={['검수전','검수중','검수완료'].map(s=>({v:s,l:s}))}/>}
      <Inp l="비고" v={f.note} c={v=>sf(p=>({...p,note:v}))} multi/>
    </div>
    <div className="flex justify-between px-6 py-4 border-t bg-gray-50">{editId?<button onClick={()=>onDel(editId)} className="text-red-500 text-sm font-medium">삭제</button>:<div/>}<div className="flex gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg">취소</button><button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">{saving?'저장중...':editId?'수정':'추가'}</button></div></div>
  </div></div>);
}

function Inp({l,v,c,ph,multi,disabled}:{l:string;v:string;c:(v:string)=>void;ph?:string;multi?:boolean;disabled?:boolean}){const cls="w-full border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500";return(<div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>{multi?<textarea value={v} onChange={e=>c(e.target.value)} placeholder={ph} rows={3} className={cls} disabled={disabled}/>:<input type="text" value={v} onChange={e=>c(e.target.value)} placeholder={ph} className={cls} disabled={disabled}/>}</div>);}
function Sel({l,v,c,opts}:{l:string;v:string;c:(v:string)=>void;opts:{v:string;l:string}[]}){return(<div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label><select value={v} onChange={e=>c(e.target.value)} className="w-full border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm">{opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></div>);}
function VerSel({l,v,c,versions,defaultVer}:{l:string;v:string;c:(v:string)=>void;versions:string[];defaultVer?:string}){const mainVer=defaultVer||versions[0]||'';const otherVers=versions.filter(ver=>ver!==mainVer);return(<div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label><select value={v} onChange={e=>c(e.target.value)} className="w-full border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">{mainVer&&<option value={mainVer}>{mainVer} (현재)</option>}{v&&v!==mainVer&&!versions.includes(v)&&<option value={v}>{v}</option>}{otherVers.length>0&&<option disabled>── 다른 버전 ──</option>}{otherVers.map(ver=><option key={ver} value={ver}>{ver}</option>)}</select></div>);}

/* ============ DevSel - 멀티셀렉트 (팀 전체선택 지원) ============ */
function DevSel({l,v,c,devs}:{l:string;v:string;c:(v:string)=>void;devs:any[]}){
  const [open,setOpen]=useState(false);
  const ref=useRef<HTMLDivElement>(null);
  const selectedIds = v ? v.split(',').filter(Boolean) : [];
  const toggle = (id:string) => { const next = selectedIds.includes(id) ? selectedIds.filter(x=>x!==id) : [...selectedIds,id]; c(next.join(',')); };
  const toggleGroup = (ids:string[]) => { const allSelected = ids.every(id=>selectedIds.includes(id)); const next = allSelected ? selectedIds.filter(x=>!ids.includes(x)) : Array.from(new Set([...selectedIds,...ids])); c(next.join(',')); setOpen(false); };
  const groups:{label:string;items:any[]}[]=[
    {label:'AOS팀',items:devs.filter(d=>d.department==='개발팀'&&d.platform==='AOS')},
    {label:'iOS팀',items:devs.filter(d=>d.department==='개발팀'&&d.platform==='iOS')},
    {label:'서버팀',items:devs.filter(d=>d.department==='서버(백앤드)'||d.department==='서버(시스템)')},
    {label:'QA팀',items:devs.filter(d=>d.platform==='QA')},
  ].filter(g=>g.items.length>0);
  const names = selectedIds.map(id=>devs.find(d=>d.id===id)?.name).filter(Boolean);
  useEffect(()=>{const handler=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false);};document.addEventListener('mousedown',handler);return()=>document.removeEventListener('mousedown',handler);},[]);
  return(
    <div ref={ref} className="relative"><label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">{l}</label>
      <button type="button" onClick={()=>setOpen(!open)} className="w-full border-2 border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 rounded-lg px-3 py-2 text-sm text-left font-medium focus:border-black dark:focus:border-white focus:outline-none flex items-center justify-between">
        <span className={names.length?'text-black dark:text-white':'text-neutral-400'}>{names.length ? names.join(', ') : '미배정'}</span>
        <ChevronDown size={14} className={`transition ${open?'rotate-180':''}`}/>
      </button>
      {open && (<div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-600 rounded-lg shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:shadow-[3px_3px_0_0_rgba(255,255,255,0.05)] max-h-64 overflow-y-auto">
        <button type="button" onClick={()=>{c('');setOpen(false);}} className={`w-full text-left px-3 py-2 text-sm font-medium border-b border-neutral-200 dark:border-neutral-700 ${selectedIds.length===0?'bg-black text-white dark:bg-white dark:text-black':'hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}>미배정</button>
        {groups.map(g=>{const gIds=g.items.map(d=>d.id);const allSel=gIds.every(id=>selectedIds.includes(id));return(<div key={g.label}>
          <button type="button" onClick={()=>toggleGroup(gIds)} className={`w-full text-left px-3 py-2 text-xs font-black uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between ${allSel?'bg-neutral-900 text-white dark:bg-white dark:text-black':'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}><span>{g.label} 전체</span><span className="text-[10px] font-bold">{allSel?'✓ 선택됨':`${g.items.length}명`}</span></button>
          {g.items.map(d=>(<button type="button" key={d.id} onClick={()=>toggle(d.id)} className={`w-full text-left px-3 pl-6 py-2 text-sm font-medium border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-2 ${selectedIds.includes(d.id)?'bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white':'hover:bg-neutral-50 dark:hover:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300'}`}><span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] ${selectedIds.includes(d.id)?'bg-black dark:bg-white border-black dark:border-white text-white dark:text-black':'border-neutral-300 dark:border-neutral-600'}`}>{selectedIds.includes(d.id)?'✓':''}</span>{d.name} <span className="text-neutral-400 text-xs">({d.role})</span></button>))}
        </div>);})}
      </div>)}
    </div>);}
