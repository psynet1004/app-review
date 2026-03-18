'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import DataTable from '@/components/table/DataTable';
import { StatusBadge, PriorityTag } from '@/components/common/StatusBadge';
import { Send, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useVersion } from '@/components/layout/Header';
import type { Priority, FixStatus, ReviewStatus } from '@/lib/types/database';
import { CommentChat, CommentBadge } from '@/components/common/CommentChat';
import { QAResultBadge, isQAComplete } from '@/components/common/QAResult';

const EXCLUDED_ROLES = ['CTO','상무이사','이사'];
const EXCLUDED_DEPTS = ['서버(시스템)','재무','데이터/광고','AIAE','운영'];

export default function ServerBugsPage() {
  const supabase = createClient();
  const { aosVersions, iosVersions, aosVersion, iosVersion, userName, userDept, userEmail } = useVersion();
  const [items, setItems] = useState<any[]>([]);
  const [devs, setDevs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<{id?:string}|null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<'incomplete'|'complete'>('incomplete');
  const [commentCounts, setCommentCounts] = useState<Record<string,number>>({});
  const [commentNew, setCommentNew] = useState<Record<string,boolean>>({});
  const [showComment, setShowComment] = useState<{id:string;type:string;title:string}|null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    const [i, d] = await Promise.all([
      supabase.from('server_bugs').select('*, developers(name)').order('created_at',{ascending:false}),
      supabase.from('developers').select('*').eq('is_active',true),
    ]);
    setItems(i.data||[]); setDevs(d.data||[]); setLoading(false);
    const allIds = (i.data||[]).map((x:any)=>x.id);
    if(allIds.length>0){
      const {data:counts}=await supabase.from('comments').select('item_id').in('item_id',allIds);
      const cMap:Record<string,number>={};(counts||[]).forEach((c:any)=>{cMap[c.item_id]=(cMap[c.item_id]||0)+1;});
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
  useEffect(()=>{load();},[load]);

  // Auto-update completed_at when item becomes fully complete
  const checkAndSetCompleted = async (item: any) => {
    const isComplete = (item.fix_status==='수정완료'||item.fix_status==='배포완료') && item.review_status==='검수완료' && isQAComplete(item);
    if (isComplete && !item.completed_at) {
      await supabase.from('server_bugs').update({ completed_at: new Date().toISOString() }).eq('id', item.id);
    } else if (!isComplete && item.completed_at) {
      await supabase.from('server_bugs').update({ completed_at: null }).eq('id', item.id);
    }
  };
  const devTeam = useMemo(()=>devs.filter(d=>['개발팀','서버(백앤드)'].includes(d.department)&&!EXCLUDED_ROLES.includes(d.role)&&!EXCLUDED_DEPTS.includes(d.department)),[devs]);
  const allVers = Array.from(new Set(aosVersions.map(v=>v.version).concat(iosVersions.map(v=>v.version))));
  const defaultVer = aosVersion || iosVersion || allVers[0] || '';
  const closeForm=()=>setShowForm(null);
  const afterSave=()=>{closeForm();load();};
  const handleBulkDel=async()=>{if(selected.size===0)return;if(!confirm(selected.size+'건 삭제?'))return;for(const id of Array.from(selected)) await supabase.from('server_bugs').delete().eq('id',id);setSelected(new Set());load();};
  const handleDel=async(id:string)=>{if(!confirm('삭제?'))return;await supabase.from('server_bugs').delete().eq('id',id);afterSave();};

  const handleSend = async()=>{
    if(selected.size===0)return;
    if(!confirm(`${selected.size}건을 전송할까요?`))return;
    await fetch('/api/send/bug-items',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({itemIds:Array.from(selected),platform:'SERVER'})});
    alert('전송 완료!');
    setSelected(new Set());
    load();
  };

  const getDevNames = (item:any) => {
    const raw = item.developer_ids || item.developer_id || "";
    if (!raw) return <span className="text-neutral-300 dark:text-neutral-600">-</span>;
    const ids = String(raw).split(",").filter(Boolean);
    const names = ids.map((id:string) => devs.find(d=>d.id===id)?.name).filter(Boolean);
    if (names.length === 0) return item.developers?.name || <span className="text-neutral-300 dark:text-neutral-600">-</span>;
    return <span className="text-xs">{names.join(", ")}</span>;
  };

  const handleReviewChange = async(id:string, val:ReviewStatus) => {
    await supabase.from('server_bugs').update({review_status:val}).eq('id',id);
    load();
    // Check completed after reload
    setTimeout(async()=>{const {data}=await supabase.from('server_bugs').select('*').eq('id',id).single();if(data)checkAndSetCompleted(data);},500);
  };
  const ReviewSel = ({item}:{item:any}) => (
    <select value={item.review_status||'검수전'} onChange={e=>handleReviewChange(item.id,e.target.value as ReviewStatus)}
      className="text-xs border border-neutral-200 dark:border-neutral-800 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-neutral-400" onClick={e=>e.stopPropagation()}>
      <option value="검수전">검수전</option><option value="검수중">검수중</option><option value="검수완료">검수완료</option>
    </select>
  );
  
  const handleFixStatusInline = async(id:string, val:string) => {
    await supabase.from('server_bugs').update({fix_status:val}).eq('id',id);
    load();
  };
  const handleDevAssignInline = async(id:string, val:string) => {
    await supabase.from('server_bugs').update({developer_ids:val||null,developer_id:null}).eq('id',id);
    load();
  };

  
  const InlineDevSel = ({item,table}:{item:any;table:string}) => {
    const [open,setOpen]=useState(false);
    const ref=useRef<HTMLDivElement>(null);
    const val = item.developer_ids||item.developer_id||'';
    const selectedIds = val ? String(val).split(',').filter(Boolean) : [];
    const names = selectedIds.map((id:string)=>devTeam.find((d:any)=>d.id===id)?.name).filter(Boolean);
    const toggle = (id:string) => {
      const next = selectedIds.includes(id) ? selectedIds.filter((x:string)=>x!==id) : [...selectedIds,id];
      supabase.from(table).update({developer_ids:next.join(',')||null,developer_id:null}).eq('id',item.id).then(()=>load());
    };
    const toggleGroup = (ids:string[]) => {
      const allSel = ids.every(id=>selectedIds.includes(id));
      const next = allSel ? selectedIds.filter((x:string)=>!ids.includes(x)) : Array.from(new Set([...selectedIds,...ids]));
      supabase.from(table).update({developer_ids:next.join(',')||null,developer_id:null}).eq('id',item.id).then(()=>load());
    };
    const clear = () => {
      supabase.from(table).update({developer_ids:null,developer_id:null}).eq('id',item.id).then(()=>load());
      setOpen(false);
    };
    const groups = [
      {label:'AOS\ud300',items:devTeam.filter((d:any)=>d.department==='\uac1c\ubc1c\ud300'&&d.platform==='AOS')},
      {label:'iOS\ud300',items:devTeam.filter((d:any)=>d.department==='\uac1c\ubc1c\ud300'&&d.platform==='iOS')},
      {label:'\uc11c\ubc84\ud300',items:devTeam.filter((d:any)=>d.department==='\uc11c\ubc84(\ubc31\uc564\ub4dc)'||d.department==='\uc11c\ubc84(\uc2dc\uc2a4\ud15c)')},
    ].filter(g=>g.items.length>0);
    useEffect(()=>{const handler=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false);};document.addEventListener('mousedown',handler);return()=>document.removeEventListener('mousedown',handler);},[]);
    return(
      <div ref={ref} className="relative">
        <button onClick={e=>{e.stopPropagation();setOpen(!open);}} className="text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:underline">
          {names.length ? names.join(', ') : <span className="text-neutral-300 dark:text-neutral-600">\ubbf8\ubc30\uc815</span>}
        </button>
        {open && (
          <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-600 rounded-lg shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:shadow-[3px_3px_0_0_rgba(255,255,255,0.05)] max-h-64 overflow-y-auto min-w-[180px]" onClick={e=>e.stopPropagation()}>
            <button type="button" onClick={clear} className={`w-full text-left px-3 py-2 text-xs font-medium border-b border-neutral-200 dark:border-neutral-700 ${selectedIds.length===0?'bg-black text-white dark:bg-white dark:text-black':'hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}>\ubbf8\ubc30\uc815</button>
            {groups.map((g:any)=>{const gIds=g.items.map((d:any)=>d.id);const allSel=gIds.every((id:string)=>selectedIds.includes(id));return(<div key={g.label}>
              <button type="button" onClick={()=>toggleGroup(gIds)} className={`w-full text-left px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between ${allSel?'bg-neutral-900 text-white dark:bg-white dark:text-black':'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'}`}><span>{g.label} \uc804\uccb4</span><span className="text-[10px]">{allSel?'\u2713':g.items.length+'\uba85'}</span></button>
              {g.items.map((d:any)=>(<button type="button" key={d.id} onClick={()=>toggle(d.id)} className={`w-full text-left px-3 pl-5 py-1.5 text-xs font-medium border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-2 ${selectedIds.includes(d.id)?'bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white':'hover:bg-neutral-50 dark:hover:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300'}`}><span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] ${selectedIds.includes(d.id)?'bg-black dark:bg-white border-black dark:border-white text-white dark:text-black':'border-neutral-300 dark:border-neutral-600'}`}>{selectedIds.includes(d.id)?'\u2713':''}</span>{d.name}</button>))}
            </div>);})})}
          </div>
        )}
      </div>
    );
  };


  const isReviewed = (item:any) => (item.fix_status==='수정완료'||item.fix_status==='배포완료') && item.review_status==='검수완료' && isQAComplete(item);

  const cols = [
    {key:'version',label:'버전',width:'w-20',sortable:true},
    {key:'priority',label:'우선순위',width:'w-24',sortable:true,align:'center' as const,render:(i:any)=><PriorityTag priority={i.priority}/>},
    {key:'location',label:'위치',sortable:true,render:(i:any)=><div><button onClick={()=>setShowForm({id:i.id})} className={`text-neutral-900 dark:text-white hover:underline font-medium text-left ${isReviewed(i)?'line-through decoration-red-500 text-neutral-400 dark:text-neutral-600':''}`}>{i.location}</button>{i.planning_link_url && <a href={i.planning_link_url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="ml-1.5 inline-flex items-center gap-1 text-[11px] text-white dark:text-black font-bold bg-blue-600 dark:bg-blue-400 hover:bg-blue-700 dark:hover:bg-blue-500 px-2 py-0.5 rounded border-2 border-blue-700 dark:border-blue-500 shadow-[1px_1px_0_0_rgba(0,0,0,0.3)] hover:shadow-none transition-all">🔗 {i.planning_link_name||'링크'}</a>}</div>},
    {key:'description',label:'설명',width:'',render:(i:any)=><button onClick={()=>setShowForm({id:i.id})} className={`text-neutral-500 dark:text-neutral-400 text-xs text-left whitespace-pre-wrap hover:underline ${isReviewed(i)?'line-through decoration-red-500':''}`}>{i.description||'-'}</button>},
    {key:'department',label:'부서',width:'w-24',align:'center' as const,render:(i:any)=><span className="text-xs">{i.department||'-'}</span>},
    {key:'reporter',label:'담당자',width:'w-20',align:'center' as const,render:(i:any)=><span className="text-xs">{i.reporter||'-'}</span>},
    {key:'developer',label:'개발담당',width:'w-28',align:'center' as const,render:(i:any)=><InlineDevSel item={i} table="bug_items"/>},
    {key:'fix_status',label:'수정결과',width:'w-24',sortable:true,align:'center' as const,render:(i:any)=><select value={i.fix_status} onChange={e=>{e.stopPropagation();handleFixStatusInline(i.id,e.target.value)}} onClick={e=>e.stopPropagation()} className="text-xs border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-700 dark:text-slate-200 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-neutral-400 font-bold"><option value="미수정">미수정</option><option value="수정중">수정중</option><option value="수정완료">수정완료</option><option value="배포완료">배포완료</option><option value="보류">보류</option></select>},
    {key:'review_status',label:'검수',width:'w-24',align:'center' as const,render:(i:any)=><ReviewSel item={i}/>},
    {key:'qa_results',label:'검수결과',width:'w-24',align:'center' as const,render:(i:any)=><QAResultBadge item={i} table="server_bugs" onUpdated={load}/>},
    {key:'comments',label:'💬',width:'w-10',align:'center' as const,render:(i:any)=><CommentBadge itemId={i.id} itemType="server_bugs" count={commentCounts[i.id]||0} hasNew={!!commentNew[i.id]} onClick={()=>setShowComment({id:i.id,type:'server_bugs',title:i.location})}/>},
    {key:'send_status',label:'전송',width:'w-20',align:'center' as const,render:(i:any)=><StatusBadge status={i.send_status} type="send"/>},
    {key:'completed_at',label:'완료일',width:'w-24',align:'center' as const,render:(i:any)=>i.completed_at?<span className="text-[10px] text-neutral-500 dark:text-neutral-400">{new Date(i.completed_at).toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'})}</span>:<span className="text-neutral-300 dark:text-neutral-600">-</span>},
  ];

  const SendBar = () => selected.size > 0 ? (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-neutral-100 dark:border-neutral-800">
      <button onClick={handleSend} className="flex items-center gap-1 bg-black text-white text-xs px-3 py-1.5 rounded-md border-2 border-black font-bold hover:shadow-[2px_2px_0_0_rgba(0,0,0,0.5)] dark:bg-white dark:text-black dark:border-white">
        <Send size={12}/>선택 전송 ({selected.size})
      </button>
      <button onClick={handleBulkDel} className="flex items-center gap-1 bg-red-600 text-white text-xs px-3 py-1.5 rounded-md border-2 border-red-700 font-bold hover:bg-red-700">
        🗑 선택 삭제 ({selected.size})
      </button>
    </div>
  ) : null;

  return(<div className="space-y-6">
    <div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">서버 오류</h1>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">서버 오류 관리</p>
    </div>
    <div className="rounded-lg border-2 border-black dark:border-neutral-700 shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:shadow-[3px_3px_0_0_rgba(255,255,255,0.05)] bg-white dark:bg-neutral-950 overflow-hidden">
      <div className="flex items-center justify-between py-3 px-4 bg-black dark:bg-neutral-800 rounded-t-md cursor-pointer select-none border-b-2 border-black dark:border-neutral-700" onClick={()=>setCollapsed(!collapsed)}>
        <div className="flex items-center gap-2">
          {collapsed?<ChevronDown size={16} className="text-white/70"/>:<ChevronUp size={16} className="text-white/70"/>}
          <h2 className="text-sm font-bold text-white">🖥️ 서버 오류</h2>
          <span className="text-xs text-white/70 bg-white/20 px-2 py-0.5 rounded-full">{items.length}건</span>
        </div>
        <button onClick={e=>{e.stopPropagation();setShowForm({});}} className="text-xs bg-white text-black font-bold px-3 py-1 rounded-md border-2 border-white hover:shadow-[2px_2px_0_0_rgba(255,255,255,0.5)] transition-all">+ 추가</button>
      </div>
      {!collapsed && <>
        <div className="flex border-b-2 border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900">
          <button onClick={()=>setTab('incomplete')} className={`px-4 py-2 text-xs font-bold transition-all ${tab==='incomplete'?'text-black dark:text-white border-b-2 border-black dark:border-white -mb-[2px]':'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}>
            수정전 ({items.filter(i=>!isReviewed(i)).length})
          </button>
          <button onClick={()=>setTab('complete')} className={`px-4 py-2 text-xs font-bold transition-all ${tab==='complete'?'text-black dark:text-white border-b-2 border-black dark:border-white -mb-[2px]':'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}>
            수정완료 ({items.filter(i=>isReviewed(i)).length})
          </button>
        </div>
        <DataTable data={tab==='incomplete'?items.filter(i=>!isReviewed(i)):items.filter(i=>isReviewed(i))} rowClassName={(i:any)=>isReviewed(i)?"bg-neutral-200 dark:bg-neutral-800/50":"bg-white dark:bg-neutral-700/40"} columns={cols} selectable selectedIds={selected} onSelectionChange={setSelected}
        searchKeys={['location','description','reporter']} searchPlaceholder="서버 오류 검색..." emptyMessage={loading?'로딩 중...':'없음'} noBorder
        toolbar={<SendBar/>}/></>}
    </div>
    {showForm&&<BugModal supabase={supabase} devTeam={devTeam} editId={showForm.id} table="server_bugs" title="서버 오류" aosVersions={aosVersions} iosVersions={iosVersions} aosVersion={aosVersion} iosVersion={iosVersion} userName={userName} userDept={userDept} onClose={closeForm} onSaved={afterSave} onDel={handleDel}/>}
    {showComment&&<CommentChat itemId={showComment.id} itemType={showComment.type as any} itemTitle={showComment.title} onClose={()=>setShowComment(null)} onCommentAdded={load}/>}
  </div>);
}

function BugModal({supabase,devTeam,editId,table,title,aosVersions,iosVersions,aosVersion,iosVersion,userName,userDept,onClose,onSaved,onDel}:any){
  const defaultVer = '서버';
  const [f,sf]=useState({version:defaultVer,location:'',description:'',priority:'보통' as Priority,department:userDept||'',reporter:userName||'',developer_ids:'',fix_status:'미수정' as FixStatus,review_status:'검수전' as ReviewStatus,planning_link_name:'',planning_link_url:'',note:''});
  const [saving,ss]=useState(false);
  useEffect(()=>{if(!editId)sf(p=>({...p,reporter:p.reporter||userName,department:p.department||userDept}));},[userName,userDept,editId]);
  useEffect(()=>{if(editId)supabase.from(table).select('*').eq('id',editId).single().then(({data}:any)=>{if(data)sf({version:data.version||'',location:data.location||'',description:data.description||'',priority:data.priority||'보통',department:data.department||'',reporter:data.reporter||'',developer_ids:data.developer_ids||data.developer_id||'',fix_status:data.fix_status||'미수정',review_status:data.review_status||'검수전',planning_link_name:data.planning_link_name||'',planning_link_url:data.planning_link_url||'',note:data.note||''});});},[editId]);
  const save=async()=>{if(!f.location.trim()){alert('위치 필수');return;}ss(true);const p:any={...f,developer_ids:f.developer_ids||null,developer_id:null};if(!editId)delete p.review_status;if(editId)await supabase.from(table).update(p).eq('id',editId);else await supabase.from(table).insert(p);ss(false);onSaved();};
  return(<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}><div className="bg-white dark:bg-neutral-900 rounded-lg border-2 border-black dark:border-neutral-600 shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:shadow-[6px_6px_0_0_rgba(255,255,255,0.05)] w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
    <div className="flex items-center justify-between px-6 py-4 border-b"><h2 className="font-bold text-lg">{editId?`${title} 수정`:`${title} 추가`}</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button></div>
    <div className="p-6 space-y-4">
      <PlatformVerSel l="버전" v={f.version} c={v=>sf(p=>({...p,version:v}))} aosVersions={aosVersions} iosVersions={iosVersions} aosVersion={aosVersion} iosVersion={iosVersion} showCommon={true} showServer={true}/>
      <Inp l="이슈 위치 *" v={f.location} c={v=>sf(p=>({...p,location:v}))}/>
      <Inp l="상세설명" v={f.description} c={v=>sf(p=>({...p,description:v}))} multi/>
      <div className="grid grid-cols-2 gap-4"><Sel l="우선순위" v={f.priority} c={v=>sf(p=>({...p,priority:v as Priority}))} opts={['긴급','높음','보통','낮음'].map(s=>({v:s,l:s}))}/><Inp l="보고자" v={f.reporter} c={()=>{}} disabled/></div>
      <div className="grid grid-cols-2 gap-4"><Inp l="부서" v={f.department} c={()=>{}} disabled/><DevSel l="개발담당" v={f.developer_ids} c={v=>sf(p=>({...p,developer_ids:v}))} devs={devTeam}/></div>
      <Sel l="수정결과" v={f.fix_status} c={v=>sf(p=>({...p,fix_status:v as FixStatus}))} opts={['미수정','수정중','수정완료','배포완료','보류'].map(s=>({v:s,l:s}))}/>
      {editId && <Sel l="검수상태" v={f.review_status} c={v=>sf(p=>({...p,review_status:v as ReviewStatus}))} opts={['검수전','검수중','검수완료'].map(s=>({v:s,l:s}))}/>}
      <div><label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">📎 참고 링크</label><div className="grid grid-cols-2 gap-2"><input type="text" value={f.planning_link_name} onChange={e=>sf(p=>({...p,planning_link_name:e.target.value}))} placeholder="링크 이름 (예: 기획서)" className="w-full border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm"/><input type="text" value={f.planning_link_url} onChange={e=>sf(p=>({...p,planning_link_url:e.target.value}))} placeholder="URL 입력" className="w-full border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm"/></div></div>
    <Inp l="비고" v={f.note} c={v=>sf(p=>({...p,note:v}))} multi/>
    </div>
    <div className="flex justify-between px-6 py-4 border-t bg-gray-50">{editId?<button onClick={()=>onDel(editId)} className="text-red-500 text-sm font-medium">삭제</button>:<div/>}<div className="flex gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg">취소</button><button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">{saving?'저장중...':editId?'수정':'추가'}</button></div></div>
  </div></div>);
}

function Inp({l,v,c,ph,multi,disabled}:{l:string;v:string;c:(v:string)=>void;ph?:string;multi?:boolean;disabled?:boolean}){const cls="w-full border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500";return(<div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>{multi?<textarea value={v} onChange={e=>c(e.target.value)} placeholder={ph} rows={3} className={cls} disabled={disabled}/>:<input type="text" value={v} onChange={e=>c(e.target.value)} placeholder={ph} className={cls} disabled={disabled}/>}</div>);}
function Sel({l,v,c,opts}:{l:string;v:string;c:(v:string)=>void;opts:{v:string;l:string}[]}){return(<div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label><select value={v} onChange={e=>c(e.target.value)} className="w-full border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm">{opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></div>);}
function VerSel({l,v,c,versions,defaultVer}:{l:string;v:string;c:(v:string)=>void;versions:string[];defaultVer?:string}){const mainVer=defaultVer||versions[0]||'';const otherVers=versions.filter(ver=>ver!==mainVer);return(<div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label><select value={v} onChange={e=>c(e.target.value)} className="w-full border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">{mainVer&&<option value={mainVer}>{mainVer} (현재)</option>}{v&&v!==mainVer&&!versions.includes(v)&&<option value={v}>{v}</option>}{otherVers.length>0&&<option disabled>── 다른 버전 ──</option>}{otherVers.map(ver=><option key={ver} value={ver}>{ver}</option>)}</select></div>);}

/* ============ PlatformVerSel - 플랫폼별 그룹화 버전 선택 ============ */
function PlatformVerSel({l,v,c,aosVersions,iosVersions,aosVersion,iosVersion,showCommon,showServer}:{l:string;v:string;c:(v:string)=>void;aosVersions:any[];iosVersions:any[];aosVersion:string;iosVersion:string;showCommon?:boolean;showServer?:boolean}){
  const aosVers = aosVersions.map((x:any)=>x.version);
  const iosVers = iosVersions.map((x:any)=>x.version);
  const aosOther = aosVers.filter((ver:string)=>ver!==aosVersion);
  const iosOther = iosVers.filter((ver:string)=>ver!==iosVersion);
  return(<div><label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">{l}</label>
    <select value={v} onChange={e=>c(e.target.value)} className="w-full border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500">
      {showCommon && <option value="공통">공통</option>}
      {showServer && <option value="서버">서버</option>}
      {v && v!=='공통' && v!=='서버' && !aosVers.includes(v) && !iosVers.includes(v) && <option value={v}>{v}</option>}
      <optgroup label="── AOS ──">
        {aosVersion && <option value={aosVersion}>{aosVersion} (현재)</option>}
        {aosOther.map((ver:string)=><option key={`aos-${ver}`} value={ver}>{ver}</option>)}
      </optgroup>
      <optgroup label="── iOS ──">
        {iosVersion && <option value={iosVersion}>{iosVersion} (현재)</option>}
        {iosOther.map((ver:string)=><option key={`ios-${ver}`} value={ver}>{ver}</option>)}
      </optgroup>
    </select></div>);}

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
