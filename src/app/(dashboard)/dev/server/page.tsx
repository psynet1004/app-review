'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import DataTable from '@/components/table/DataTable';
import { StatusBadge, PriorityTag } from '@/components/common/StatusBadge';
import { Send, Plus, X, ArrowRightLeft, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import { useVersion } from '@/components/layout/Header';
import type { DevStatus, FixStatus, Priority, ReviewStatus } from '@/lib/types/database';
import { CommentChat, CommentBadge } from '@/components/common/CommentChat';
import { QAResultBadge, isQAComplete } from '@/components/common/QAResult';
import { InlineDevSel } from '@/components/common/InlineDevSel';

const PLATFORM = 'SERVER';
const EXCLUDED_ROLES = ['CTO','상무이사','이사'];
const EXCLUDED_DEPTS = ['재무','데이터/광고','AIAE','운영'];

export default function AosPage() {
  const supabase = createClient();
  const { serverVersion: selectedVer, serverVersions: allVersions, userName, userDept, userEmail } = useVersion();
  const [rawDev, setRawDev] = useState<any[]>([]);
  const [rawBug, setRawBug] = useState<any[]>([]);
  const [rawCommon, setRawCommon] = useState<any[]>([]);
  const [rawServer, setRawServer] = useState<any[]>([]);
  const [developers, setDevelopers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<{type:'dev'|'bug'|'common'|'server';id?:string}|null>(null);
  const [collapsed, setCollapsed] = useState<Record<string,boolean>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string,number>>({});
  const [commentNew, setCommentNew] = useState<Record<string,boolean>>({});
  const [showComment, setShowComment] = useState<{id:string;type:string;title:string}|null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [d,b,c,s,devs] = await Promise.all([
      supabase.from('dev_items').select('*, developers(name)').eq('platform', PLATFORM).order('created_at',{ascending:false}),
      supabase.from('bug_items').select('*, developers(name)').eq('platform', PLATFORM).order('created_at',{ascending:false}),
      supabase.from('common_bugs').select('*, developers(name)').order('created_at',{ascending:false}),
      supabase.from('server_bugs').select('*, developers(name)').order('created_at',{ascending:false}),
      supabase.from('developers').select('*').eq('is_active',true),
    ]);
    setRawDev(d.data||[]); setRawBug(b.data||[]); setRawCommon(c.data||[]); setRawServer(s.data||[]);
    setDevelopers(devs.data||[]); setLoading(false);
    // Load comment counts
    const allIds = [...(d.data||[]),...(b.data||[]),...(c.data||[]),...(s.data||[])].map(i=>i.id);
    if(allIds.length>0){
      const {data:counts}=await supabase.from('comments').select('item_id').in('item_id',allIds);
      const cMap:Record<string,number>={};
      (counts||[]).forEach((c:any)=>{cMap[c.item_id]=(cMap[c.item_id]||0)+1;});
      setCommentCounts(cMap);
      // Check new comments
      if(userEmail){
        const {data:reads}=await supabase.from('comment_reads').select('item_id,last_read_at').eq('user_email',userEmail).in('item_id',allIds);
        const readMap:Record<string,string>={};
        (reads||[]).forEach((r:any)=>{readMap[r.item_id]=r.last_read_at;});
        const {data:latest}=await supabase.from('comments').select('item_id,created_at').in('item_id',allIds).order('created_at',{ascending:false});
        const latestMap:Record<string,string>={};
        (latest||[]).forEach((l:any)=>{if(!latestMap[l.item_id])latestMap[l.item_id]=l.created_at;});
        const nMap:Record<string,boolean>={};
        allIds.forEach(id=>{if(latestMap[id]&&(!readMap[id]||new Date(latestMap[id])>new Date(readMap[id])))nMap[id]=true;});
        setCommentNew(nMap);
      }
    }
  },[]);

  useEffect(()=>{loadData();},[loadData]);

  // 개발담당: 개발팀(팀원/팀장) + 서버(백앤드)(팀원/팀장)만
  const devTeam = useMemo(()=>developers.filter(d=>
    ['개발팀','서버(백앤드)'].includes(d.department) &&
    !EXCLUDED_ROLES.includes(d.role) &&
    !EXCLUDED_DEPTS.includes(d.department)
  ),[developers]);

  const filterVer = useCallback((items: any[], statusField: string) => {
    if (!selectedVer) return items;
    const thisVer = items.filter(i => i.version === selectedVer);
    const verList = allVersions.map(v => v.version);
    const curIdx = verList.indexOf(selectedVer);
    const olderVers = curIdx >= 0 ? verList.slice(curIdx + 1) : [];
    const incomplete = statusField === 'dev_status'
      ? ['대기','개발중','보류']
      : ['미수정','수정중','보류'];
    const carried = items
      .filter(i => olderVers.includes(i.version) && incomplete.includes(i[statusField]))
      .map(i => ({ ...i, _carried: true, _origVer: i.version }));
    return [...thisVer, ...carried];
  }, [selectedVer, allVersions]);

  const devItems = useMemo(() => filterVer(rawDev, 'dev_status'), [rawDev, filterVer]);
  const bugItems = useMemo(() => filterVer(rawBug, 'fix_status'), [rawBug, filterVer]);
  const commonItems = useMemo(() => rawCommon, [rawCommon]);
  const serverItems = useMemo(() => rawServer, [rawServer]);

  const toggle = (k:string) => setCollapsed(p=>({...p,[k]:!p[k]}));
  const closeForm=()=>setShowForm(null);
  const afterSave=()=>{closeForm();loadData();};

  const CarriedBadge = ({item}:{item:any}) => item._carried ? (
    <span className="inline-flex items-center gap-0.5 text-[10px] bg-white text-neutral-700 border-2 border-neutral-400 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-600 px-1.5 py-0.5 rounded-full font-medium ml-1">
      <ArrowRightLeft size={9}/>{item._origVer}
    </span>
  ) : null;

  const [selDev, setSelDev] = useState<Set<string>>(new Set());
  const [selBug, setSelBug] = useState<Set<string>>(new Set());
  const [selCommon, setSelCommon] = useState<Set<string>>(new Set());
  const [commonTab, setCommonTab] = useState<'incomplete'|'complete'>('incomplete');
  const [selServer, setSelServer] = useState<Set<string>>(new Set());
  const [serverTab, setServerTab] = useState<'incomplete'|'complete'>('incomplete');

  const getDevNames = (item:any) => {
    const raw = item.developer_ids || item.developer_id || "";
    if (!raw) return <span className="text-neutral-300 dark:text-neutral-600">-</span>;
    const ids = String(raw).split(",").filter(Boolean);
    const names = ids.map((id:string) => developers.find(d=>d.id===id)?.name).filter(Boolean);
    if (names.length === 0) return item.developers?.name || <span className="text-neutral-300 dark:text-neutral-600">-</span>;
    return <span className="text-xs">{names.join(", ")}</span>;
  };

  // 검수상태 인라인 변경
  const handleReviewChange = async(table:string, id:string, val:ReviewStatus) => {
    await supabase.from(table).update({review_status:val}).eq('id',id);
    loadData();
  };

  const ReviewSel = ({item,table}:{item:any;table:string}) => (
    <select value={item.review_status||'검수전'} onChange={e=>handleReviewChange(table,item.id,e.target.value as ReviewStatus)}
      className={`text-xs border-0 rounded px-2 py-1 font-bold focus:ring-1 focus:ring-neutral-400 ${item.review_status==='검수전'?'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-200':item.review_status==='검수중'?'bg-amber-50 dark:bg-amber-800/50 text-amber-700 dark:text-amber-200':'bg-green-50 dark:bg-green-800/50 text-green-700 dark:text-green-200'}`}
      onClick={e=>e.stopPropagation()}>
      <option value="검수전">검수전</option>
      <option value="검수중">검수중</option>
      <option value="검수완료">검수완료</option>
    </select>
  );

  // 검수완료 시 취소선
  const isReviewed = (item:any) => (item.fix_status==='수정완료'||item.fix_status==='배포완료') && item.review_status==='검수완료' && isQAComplete(item);

  // 개발항목 검수상태 인라인 변경
  const handleDevReviewChange = async(id:string, val:ReviewStatus) => {
    await supabase.from('dev_items').update({review_status:val}).eq('id',id);
    loadData();
  };
  const DevReviewSel = ({item}:{item:any}) => (
    <select value={item.review_status||'검수전'} onChange={e=>handleDevReviewChange(item.id,e.target.value as ReviewStatus)}
      className={`text-xs border-0 rounded px-2 py-1 font-bold focus:ring-1 focus:ring-neutral-400 ${item.review_status==='검수전'?'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-200':item.review_status==='검수중'?'bg-amber-50 dark:bg-amber-800/50 text-amber-700 dark:text-amber-200':'bg-green-50 dark:bg-green-800/50 text-green-700 dark:text-green-200'}`}
      onClick={e=>e.stopPropagation()}>
      <option value="검수전">검수전</option>
      <option value="검수중">검수중</option>
      <option value="검수완료">검수완료</option>
    </select>
  );

  
  // Inline status change handlers
  const handleDevStatusChange = async(id:string, val:string) => {
    await supabase.from('dev_items').update({dev_status:val}).eq('id',id);
    loadData();
  };
  const handleFixStatusChange = async(table:string, id:string, val:string) => {
    await supabase.from(table).update({fix_status:val}).eq('id',id);
    loadData();
  };
  const handleDevAssignChange = async(table:string, id:string, val:string) => {
    await supabase.from(table).update({developer_ids:val||null,developer_id:null}).eq('id',id);
    loadData();
  };

  const isDevReviewed = (item:any) => item.dev_status==='배포완료' && item.review_status==='검수완료' && isQAComplete(item);

  const devCols = [
    {key:'version',label:'버전',width:'w-28',sortable:true, render:(i:any)=><div className="flex items-center">{i.version}<CarriedBadge item={i}/></div>},
    {key:'menu_item',label:'항목',sortable:true,render:(i:any)=><div><button onClick={()=>setShowForm({type:'dev',id:i.id})} className={`text-neutral-900 dark:text-white hover:underline font-medium text-left ${isDevReviewed(i)?'line-through decoration-red-500 text-neutral-400 dark:text-neutral-600':''}`}>{i.menu_item}</button>
      {i.planning_link_url && <a href={i.planning_link_url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="ml-1.5 inline-flex items-center gap-1 text-[11px] text-white dark:text-black font-bold bg-blue-600 dark:bg-blue-400 hover:bg-blue-700 dark:hover:bg-blue-500 px-2 py-0.5 rounded border-2 border-blue-700 dark:border-blue-500 shadow-[1px_1px_0_0_rgba(0,0,0,0.3)] hover:shadow-none transition-all">🔗 {i.planning_link_name||'링크'}</a>}
    </div>},
    {key:'description',label:'설명',width:'',render:(i:any)=><button onClick={()=>setShowForm({type:'dev',id:i.id})} className={`text-neutral-500 dark:text-white text-xs text-left whitespace-pre-wrap hover:underline cursor-pointer ${isDevReviewed(i)?'line-through decoration-red-500':''}`}>{i.description||'-'}</button>},
    {key:'is_required',label:'필수',width:'w-8',align:'center' as const,render:(i:any)=>i.is_required?<span className="text-xs font-bold text-red-600 dark:text-red-400">Y</span>:<span className="text-neutral-300 dark:text-neutral-600">-</span>},
    {key:'department',label:'부서',width:'w-24',align:'center' as const,render:(i:any)=><span className="text-xs">{i.department||'-'}</span>},
    {key:'requester',label:'담당자',width:'w-20',align:'center' as const,render:(i:any)=><span className="text-xs">{i.requester||'-'}</span>},
    {key:'developer',label:'개발담당',width:'w-28',align:'center' as const,render:(i:any)=><InlineDevSel item={i} table="dev_items" developers={devTeam} onUpdated={loadData}/>},
    {key:'dev_status',label:'상태',width:'w-24',sortable:true,align:'center' as const,render:(i:any)=>{const dc:Record<string,string>={'대기':'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-200','개발중':'bg-blue-50 dark:bg-blue-800/50 text-blue-700 dark:text-blue-200','개발완료':'bg-emerald-50 dark:bg-emerald-800/50 text-emerald-700 dark:text-emerald-200','배포완료':'bg-purple-50 dark:bg-purple-800/50 text-purple-700 dark:text-purple-200','보류':'bg-neutral-200 dark:bg-neutral-600 text-neutral-500 dark:text-neutral-300'};return <select value={i.dev_status} onChange={e=>{e.stopPropagation();handleDevStatusChange(i.id,e.target.value)}} onClick={e=>e.stopPropagation()} className={`text-xs border-0 rounded px-2 py-1 font-bold focus:ring-1 focus:ring-neutral-400 ${dc[i.dev_status]||'bg-neutral-100'}`}><option value="대기">대기</option><option value="개발중">개발중</option><option value="개발완료">개발완료</option><option value="배포완료">배포완료</option><option value="보류">보류</option></select>}},
    {key:'review_status',label:'검수',width:'w-24',align:'center' as const,render:(i:any)=><DevReviewSel item={i}/>},
    {key:'qa_results',label:'검수결과',width:'w-24',align:'center' as const,render:(i:any)=><QAResultBadge item={i} table="dev_items" onUpdated={loadData}/>},
    {key:'comments',label:'💬',width:'w-10',align:'center' as const,render:(i:any)=><CommentBadge itemId={i.id} itemType="dev_items" count={commentCounts[i.id]||0} hasNew={!!commentNew[i.id]} onClick={()=>setShowComment({id:i.id,type:'dev_items',title:i.menu_item})}/>},
    {key:'send_status',label:'전송',width:'w-20',align:'center' as const,render:(i:any)=><StatusBadge status={i.send_status} type="send"/>},
  ];

  const bugCols = [
    {key:'version',label:'버전',width:'w-28',sortable:true, render:(i:any)=><div className="flex items-center">{i.version}<CarriedBadge item={i}/></div>},
    {key:'priority',label:'우선순위',width:'w-24',sortable:true,align:'center' as const,render:(i:any)=><PriorityTag priority={i.priority}/>},
    {key:'location',label:'위치',sortable:true,render:(i:any)=><div><button onClick={()=>setShowForm({type:'bug',id:i.id})} className={`text-neutral-900 dark:text-white hover:underline font-medium text-left ${isReviewed(i)?'line-through decoration-red-500 text-neutral-400 dark:text-neutral-600':''}`}>{i.location}</button>{i.planning_link_url && <a href={i.planning_link_url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="ml-1.5 inline-flex items-center gap-1 text-[11px] text-white dark:text-black font-bold bg-blue-600 dark:bg-blue-400 hover:bg-blue-700 dark:hover:bg-blue-500 px-2 py-0.5 rounded border-2 border-blue-700 dark:border-blue-500 shadow-[1px_1px_0_0_rgba(0,0,0,0.3)] hover:shadow-none transition-all">🔗 {i.planning_link_name||'링크'}</a>}</div>},
    {key:'description',label:'설명',width:'',render:(i:any)=><button onClick={()=>setShowForm({type:'bug',id:i.id})} className={`text-neutral-500 dark:text-white text-xs text-left whitespace-pre-wrap hover:underline cursor-pointer ${isReviewed(i)?'line-through decoration-red-500':''}`}>{i.description||'-'}</button>},
    {key:'department',label:'부서',width:'w-24',align:'center' as const,render:(i:any)=><span className="text-xs">{i.department||'-'}</span>},
    {key:'reporter',label:'담당자',width:'w-20',align:'center' as const,render:(i:any)=><span className="text-xs">{i.reporter||'-'}</span>},
    {key:'developer',label:'개발담당',width:'w-28',align:'center' as const,render:(i:any)=><InlineDevSel item={i} table="bug_items" developers={devTeam} onUpdated={loadData}/>},
    {key:'fix_status',label:'수정결과',width:'w-24',sortable:true,align:'center' as const,render:(i:any)=>{const fc:Record<string,string>={'미수정':'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-200','수정중':'bg-blue-50 dark:bg-blue-800/50 text-blue-700 dark:text-blue-200','수정완료':'bg-red-50 dark:bg-red-800/50 text-red-700 dark:text-red-200','배포완료':'bg-purple-50 dark:bg-purple-800/50 text-purple-700 dark:text-purple-200','보류':'bg-neutral-200 dark:bg-neutral-600 text-neutral-500 dark:text-neutral-300'};return <select value={i.fix_status} onChange={e=>{e.stopPropagation();handleFixStatusChange('bug_items',i.id,e.target.value)}} onClick={e=>e.stopPropagation()} className={`text-xs border-0 rounded px-2 py-1 font-bold focus:ring-1 focus:ring-neutral-400 ${fc[i.fix_status]||'bg-neutral-100'}`}><option value="미수정">미수정</option><option value="수정중">수정중</option><option value="수정완료">수정완료</option><option value="배포완료">배포완료</option><option value="보류">보류</option></select>}},
    {key:'review_status',label:'검수',width:'w-24',align:'center' as const,render:(i:any)=><ReviewSel item={i} table="bug_items"/>},
    {key:'qa_results',label:'검수결과',width:'w-24',align:'center' as const,render:(i:any)=><QAResultBadge item={i} table="bug_items" onUpdated={loadData}/>},
    {key:'comments',label:'💬',width:'w-10',align:'center' as const,render:(i:any)=><CommentBadge itemId={i.id} itemType="bug_items" count={commentCounts[i.id]||0} hasNew={!!commentNew[i.id]} onClick={()=>setShowComment({id:i.id,type:'bug_items',title:i.location})}/>},
    {key:'send_status',label:'전송',width:'w-20',align:'center' as const,render:(i:any)=><StatusBadge status={i.send_status} type="send"/>},
  ];

  const commonCols = bugCols.map(c=>{
    if(c.key==='location') return {...c,render:(i:any)=><div><button onClick={()=>setShowForm({type:'common',id:i.id})} className={`text-neutral-900 dark:text-white hover:underline font-medium text-left ${isReviewed(i)?'line-through decoration-red-500 text-neutral-400 dark:text-neutral-600':''}`}>{i.location}</button>{i.planning_link_url && <a href={i.planning_link_url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="ml-1.5 inline-flex items-center gap-1 text-[11px] text-white dark:text-black font-bold bg-blue-600 dark:bg-blue-400 hover:bg-blue-700 dark:hover:bg-blue-500 px-2 py-0.5 rounded border-2 border-blue-700 dark:border-blue-500 shadow-[1px_1px_0_0_rgba(0,0,0,0.3)] hover:shadow-none transition-all">🔗 {i.planning_link_name||'링크'}</a>}</div>};
    if(c.key==='review_status') return {...c,render:(i:any)=><ReviewSel item={i} table="common_bugs"/>};
    if(c.key==='qa_results') return {...c,render:(i:any)=><QAResultBadge item={i} table="common_bugs" onUpdated={loadData}/>};
    if(c.key==='fix_status') return {...c,render:(i:any)=>{const fc:Record<string,string>={'미수정':'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-200','수정중':'bg-blue-50 dark:bg-blue-800/50 text-blue-700 dark:text-blue-200','수정완료':'bg-red-50 dark:bg-red-800/50 text-red-700 dark:text-red-200','배포완료':'bg-purple-50 dark:bg-purple-800/50 text-purple-700 dark:text-purple-200','보류':'bg-neutral-200 dark:bg-neutral-600 text-neutral-500 dark:text-neutral-300'};return <select value={i.fix_status} onChange={e=>{e.stopPropagation();handleFixStatusChange('common_bugs',i.id,e.target.value)}} onClick={e=>e.stopPropagation()} className={`text-xs border-0 rounded px-2 py-1 font-bold focus:ring-1 focus:ring-neutral-400 ${fc[i.fix_status]||'bg-neutral-100'}`}><option value="미수정">미수정</option><option value="수정중">수정중</option><option value="수정완료">수정완료</option><option value="배포완료">배포완료</option><option value="보류">보류</option></select>}};
    if(c.key==='developer') return {...c,render:(i:any)=><InlineDevSel item={i} table="common_bugs" developers={devTeam} onUpdated={loadData}/>};
    if(c.key==='comments') return {...c,render:(i:any)=><CommentBadge itemId={i.id} itemType="common_bugs" count={commentCounts[i.id]||0} hasNew={!!commentNew[i.id]} onClick={()=>setShowComment({id:i.id,type:'common_bugs',title:i.location})}/>};
    return c;
  });
  const serverCols = bugCols.map(c=>{
    if(c.key==='location') return {...c,render:(i:any)=><div><button onClick={()=>setShowForm({type:'server',id:i.id})} className={`text-neutral-900 dark:text-white hover:underline font-medium text-left ${isReviewed(i)?'line-through decoration-red-500 text-neutral-400 dark:text-neutral-600':''}`}>{i.location}</button>{i.planning_link_url && <a href={i.planning_link_url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="ml-1.5 inline-flex items-center gap-1 text-[11px] text-white dark:text-black font-bold bg-blue-600 dark:bg-blue-400 hover:bg-blue-700 dark:hover:bg-blue-500 px-2 py-0.5 rounded border-2 border-blue-700 dark:border-blue-500 shadow-[1px_1px_0_0_rgba(0,0,0,0.3)] hover:shadow-none transition-all">🔗 {i.planning_link_name||'링크'}</a>}</div>};
    if(c.key==='review_status') return {...c,render:(i:any)=><ReviewSel item={i} table="server_bugs"/>};
    if(c.key==='qa_results') return {...c,render:(i:any)=><QAResultBadge item={i} table="server_bugs" onUpdated={loadData}/>};
    if(c.key==='fix_status') return {...c,render:(i:any)=>{const fc:Record<string,string>={'미수정':'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-200','수정중':'bg-blue-50 dark:bg-blue-800/50 text-blue-700 dark:text-blue-200','수정완료':'bg-red-50 dark:bg-red-800/50 text-red-700 dark:text-red-200','배포완료':'bg-purple-50 dark:bg-purple-800/50 text-purple-700 dark:text-purple-200','보류':'bg-neutral-200 dark:bg-neutral-600 text-neutral-500 dark:text-neutral-300'};return <select value={i.fix_status} onChange={e=>{e.stopPropagation();handleFixStatusChange('server_bugs',i.id,e.target.value)}} onClick={e=>e.stopPropagation()} className={`text-xs border-0 rounded px-2 py-1 font-bold focus:ring-1 focus:ring-neutral-400 ${fc[i.fix_status]||'bg-neutral-100'}`}><option value="미수정">미수정</option><option value="수정중">수정중</option><option value="수정완료">수정완료</option><option value="배포완료">배포완료</option><option value="보류">보류</option></select>}};
    if(c.key==='developer') return {...c,render:(i:any)=><InlineDevSel item={i} table="server_bugs" developers={devTeam} onUpdated={loadData}/>};
    if(c.key==='comments') return {...c,render:(i:any)=><CommentBadge itemId={i.id} itemType="server_bugs" count={commentCounts[i.id]||0} hasNew={!!commentNew[i.id]} onClick={()=>setShowComment({id:i.id,type:'server_bugs',title:i.location})}/>};
    return c;
  });

  const handleSend = async(type:'dev'|'bug'|'common'|'server', ids:Set<string>)=>{
    if(ids.size===0)return;
    if(!confirm(`${ids.size}건을 전송할까요?`))return;
    const endpoint = type==='dev'?'/api/send/dev-items':'/api/send/bug-items';
    await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({itemIds:Array.from(ids),platform:PLATFORM})});
    alert('전송 완료!');
    if(type==='dev')setSelDev(new Set()); else if(type==='bug')setSelBug(new Set()); else if(type==='common')setSelCommon(new Set()); else setSelServer(new Set());
    loadData();
  };

  const handleVersionMove = async(type:string, ids:Set<string>, targetVersion:string)=>{
    if(ids.size===0||!targetVersion)return;
    if(!confirm(ids.size+'건을 '+targetVersion+'으로 이동할까요?'))return;
    const tbl = type==='dev'?'dev_items':type==='bug'?'bug_items':type==='common'?'common_bugs':'server_bugs';
    for(const id of Array.from(ids)) await supabase.from(tbl).update({version:targetVersion}).eq('id',id);
    if(type==='dev')setSelDev(new Set()); else if(type==='bug')setSelBug(new Set()); else if(type==='common')setSelCommon(new Set()); else setSelServer(new Set());
    loadData();
  };

  const handleBulkDel = async(type:string, ids:Set<string>)=>{
    if(ids.size===0)return;
    if(!confirm(ids.size+'\uac74\uc744 \uc0ad\uc81c\ud560\uae4c\uc694?'))return;
    const tbl = type==='dev'?'dev_items':type==='bug'?'bug_items':type==='common'?'common_bugs':'server_bugs';
    for(const id of Array.from(ids)) await supabase.from(tbl).delete().eq('id',id);
    if(type==='dev')setSelDev(new Set()); else if(type==='bug')setSelBug(new Set()); else if(type==='common')setSelCommon(new Set()); else setSelServer(new Set());
    loadData();
  };

  const handleDel = async(type:string,id:string)=>{
    if(!confirm('삭제할까요?'))return;
    const tbl = type==='dev'?'dev_items':type==='bug'?'bug_items':type==='common'?'common_bugs':'server_bugs';
    await supabase.from(tbl).delete().eq('id',id);
    afterSave();
  };

  const SectionHeader = ({title,count,color,sectionKey,onAdd}:{title:string;count:number;color:string;sectionKey:string;onAdd:()=>void}) => (
    <div className={`flex items-center justify-between py-3 px-4 bg-black dark:bg-neutral-800 rounded-t-md cursor-pointer select-none border-b-2 border-black dark:border-neutral-700`} onClick={()=>toggle(sectionKey)}>
      <div className="flex items-center gap-2">
        {collapsed[sectionKey]?<ChevronDown size={16} className="text-white/70"/>:<ChevronUp size={16} className="text-white/70"/>}
        <h2 className="text-sm font-bold text-white">{title}</h2>
        <span className="text-xs text-white/70 bg-white/20 px-2 py-0.5 rounded-full">{count}건</span>
      </div>
      <button onClick={(e)=>{e.stopPropagation();onAdd();}} className="text-xs bg-white text-black font-bold px-3 py-1 rounded-md border-2 border-white hover:shadow-[2px_2px_0_0_rgba(255,255,255,0.5)] transition-all">+ 추가</button>
    </div>
  );

  const [moveVer, setMoveVer] = useState('');
  const SendBar = ({ids,onSend,onDelete,onMove}:{ids:Set<string>;onSend:()=>void;onDelete:()=>void;onMove:(ver:string)=>void}) => ids.size > 0 ? (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-neutral-800/50 border-b border-neutral-100 dark:border-neutral-800">
      <button onClick={onSend} className="flex items-center gap-1 bg-black text-white text-xs px-3 py-1.5 rounded-md border-2 border-black font-bold hover:shadow-[2px_2px_0_0_rgba(0,0,0,0.5)] dark:bg-white dark:text-black dark:border-white">
        <Send size={12}/>선택 전송 ({ids.size})
      </button>
      <button onClick={onDelete} className="flex items-center gap-1 bg-red-600 text-white text-xs px-3 py-1.5 rounded-md border-2 border-red-700 font-bold hover:bg-red-700">
        🗑 선택 삭제 ({ids.size})
      </button>
      <div className="flex items-center gap-1 ml-2 border-l-2 border-neutral-300 dark:border-neutral-600 pl-2">
        <select value={moveVer} onChange={e=>setMoveVer(e.target.value)} onClick={e=>e.stopPropagation()}
          className="text-xs border-2 border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-black dark:text-white rounded-md px-2 py-1 font-bold focus:border-black dark:focus:border-white focus:outline-none">
          <option value="">버전 선택</option>
          {versionList.map(v=><option key={v} value={v}>{v}</option>)}
        </select>
        <button onClick={()=>{if(moveVer)onMove(moveVer);setMoveVer('');}} disabled={!moveVer}
          className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border-2 font-bold ${moveVer?'bg-blue-600 text-white border-blue-700 hover:bg-blue-700':'bg-neutral-200 text-neutral-400 border-neutral-300 dark:bg-neutral-700 dark:text-neutral-500 dark:border-neutral-600 cursor-not-allowed'}`}>
          ⇀ 이동 ({ids.size})
        </button>
      </div>
    </div>
  ) : null;

  const versionList = allVersions.map(v => v.version);

  return (<div className="space-y-6">
    <div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">서버</h1>
      {selectedVer && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">선택 버전: <span className="font-semibold text-gray-700">{selectedVer}</span></p>}
    </div>

    <div className="rounded-lg border-2 border-black dark:border-neutral-700 shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:shadow-[3px_3px_0_0_rgba(255,255,255,0.05)] overflow-hidden">
      <SectionHeader title="📋 개발항목" count={devItems.length} color="cel-dev" sectionKey="dev" onAdd={()=>setShowForm({type:'dev'})}/>
      {!collapsed.dev && <DataTable data={devItems} columns={devCols} selectable selectedIds={selDev} onSelectionChange={setSelDev}
        rowClassName={(i:any)=>isDevReviewed(i)?'bg-neutral-200 dark:bg-neutral-800/50':'bg-white dark:bg-neutral-700/40'}
        searchKeys={['menu_item','description','department']} searchPlaceholder="개발항목 검색..." emptyMessage={loading?'로딩 중...':'등록된 항목 없음'}
        toolbar={<SendBar ids={selDev} onSend={()=>handleSend('dev',selDev)} onDelete={()=>handleBulkDel('dev',selDev)} onMove={(ver:string)=>handleVersionMove('dev',selDev,ver)}/>}/>}
    </div>

    <div className="rounded-lg border-2 border-black dark:border-neutral-700 shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:shadow-[3px_3px_0_0_rgba(255,255,255,0.05)] overflow-hidden">
      <SectionHeader title="⚠️ 공통 오류" count={commonItems.length} color="cel-common" sectionKey="common" onAdd={()=>setShowForm({type:'common'})}/>
      {!collapsed.common && <>
        <div className="flex border-b-2 border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900">
          <button onClick={()=>setCommonTab('incomplete')} className={`px-4 py-2 text-xs font-bold transition-all ${commonTab==='incomplete'?'text-black dark:text-white border-b-2 border-black dark:border-white -mb-[2px]':'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}>
            수정전 ({commonItems.filter(i=>!isReviewed(i)).length})
          </button>
          <button onClick={()=>setCommonTab('complete')} className={`px-4 py-2 text-xs font-bold transition-all ${commonTab==='complete'?'text-black dark:text-white border-b-2 border-black dark:border-white -mb-[2px]':'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}>
            수정완료 ({commonItems.filter(i=>isReviewed(i)).length})
          </button>
        </div>
        <DataTable data={commonTab==='incomplete'?commonItems.filter(i=>!isReviewed(i)):commonItems.filter(i=>isReviewed(i))} columns={commonCols} selectable selectedIds={selCommon} onSelectionChange={setSelCommon}
        rowClassName={(i:any)=>isReviewed(i)?'bg-neutral-200 dark:bg-neutral-800/50':'bg-white dark:bg-neutral-700/40'}
        searchKeys={['location','description']} searchPlaceholder="공통 오류 검색..." emptyMessage={loading?'로딩 중...':'등록된 오류 없음'}
        toolbar={<SendBar ids={selCommon} onSend={()=>handleSend('common',selCommon)} onDelete={()=>handleBulkDel('common',selCommon)} onMove={(ver:string)=>handleVersionMove('common',selCommon,ver)}/>}/></>}
    </div>

    <div className="rounded-lg border-2 border-black dark:border-neutral-700 shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:shadow-[3px_3px_0_0_rgba(255,255,255,0.05)] overflow-hidden">
      <SectionHeader title="🖥️ 서버 오류" count={serverItems.length} color="cel-server" sectionKey="server" onAdd={()=>setShowForm({type:'server'})}/>
      {!collapsed.server && <>
        <div className="flex border-b-2 border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900">
          <button onClick={()=>setServerTab('incomplete')} className={`px-4 py-2 text-xs font-bold transition-all ${serverTab==='incomplete'?'text-black dark:text-white border-b-2 border-black dark:border-white -mb-[2px]':'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}>
            수정전 ({serverItems.filter(i=>!isReviewed(i)).length})
          </button>
          <button onClick={()=>setServerTab('complete')} className={`px-4 py-2 text-xs font-bold transition-all ${serverTab==='complete'?'text-black dark:text-white border-b-2 border-black dark:border-white -mb-[2px]':'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}>
            수정완료 ({serverItems.filter(i=>isReviewed(i)).length})
          </button>
        </div>
        <DataTable data={serverTab==='incomplete'?serverItems.filter(i=>!isReviewed(i)):serverItems.filter(i=>isReviewed(i))} columns={serverCols} selectable selectedIds={selServer} onSelectionChange={setSelServer}
        rowClassName={(i:any)=>isReviewed(i)?'bg-neutral-200 dark:bg-neutral-800/50':'bg-white dark:bg-neutral-700/40'}
        searchKeys={['location','description']} searchPlaceholder="서버 오류 검색..." emptyMessage={loading?'로딩 중...':'등록된 오류 없음'}
        toolbar={<SendBar ids={selServer} onSend={()=>handleSend('server',selServer)} onDelete={()=>handleBulkDel('server',selServer)} onMove={(ver:string)=>handleVersionMove('server',selServer,ver)}/>}/></>}
    </div>

    {showForm?.type==='dev'&&<DevForm supabase={supabase} devTeam={devTeam} editId={showForm.id} platform={PLATFORM} defaultVersion={selectedVer} versionList={versionList} userName={userName} userDept={userDept} onClose={closeForm} onSaved={afterSave} onDel={(id:string)=>handleDel('dev',id)}/>}
    {showForm?.type==='common'&&<BugForm supabase={supabase} devTeam={devTeam} editId={showForm.id} table="common_bugs" defaultVersion={selectedVer} versionList={versionList} userName={userName} userDept={userDept} onClose={closeForm} onSaved={afterSave} onDel={(id:string)=>handleDel('common',id)}/>}
    {showForm?.type==='server'&&<BugForm supabase={supabase} devTeam={devTeam} editId={showForm.id} table="server_bugs" defaultVersion={selectedVer} versionList={versionList} userName={userName} userDept={userDept} onClose={closeForm} onSaved={afterSave} onDel={(id:string)=>handleDel('server',id)}/>}
    {showComment&&<CommentChat itemId={showComment.id} itemType={showComment.type as any} itemTitle={showComment.title} onClose={()=>setShowComment(null)} onCommentAdded={loadData}/>}
  </div>);
}

/* ============ DevForm ============ */
function DevForm({supabase,devTeam,editId,platform,defaultVersion,versionList,userName,userDept,onClose,onSaved,onDel}:any){
  const [f,sf]=useState({version:defaultVersion||'',menu_item:'',description:'',is_required:false,department:userDept||'',requester:userName||'',developer_ids:'',dev_status:'대기' as DevStatus,review_status:'검수전' as ReviewStatus,planning_link_url:'',planning_link_name:'',note:''});
  const [saving,ss]=useState(false);
  useEffect(()=>{if(!editId){sf(p=>({...p,requester:p.requester||userName,department:p.department||userDept}));}},[userName,userDept,editId]);
  useEffect(()=>{if(editId)supabase.from('dev_items').select('*').eq('id',editId).single().then(({data}:any)=>{if(data)sf({version:data.version||'',menu_item:data.menu_item||'',description:data.description||'',is_required:data.is_required||false,department:data.department||'',requester:data.requester||'',developer_ids:data.developer_ids||data.developer_id||'',dev_status:data.dev_status||'대기',review_status:data.review_status||'검수전',planning_link_name:data.planning_link_name||'',planning_link_url:data.planning_link_url||'',note:data.note||''});});},[editId]);
  const OTHER_PLATFORMS = platform==='AOS'?['iOS','SERVER']:platform==='iOS'?['AOS','SERVER']:['AOS','iOS'];
  const [crossWith,setCrossWith]=useState<string[]>([]);
  const save=async()=>{
    if(!f.menu_item.trim()){alert('항목명 필수');return;}
    ss(true);
    const devIds = Array.isArray(f.developer_ids) ? (f.developer_ids.length > 0 ? f.developer_ids : null) : (f.developer_ids && f.developer_ids !== '' ? [f.developer_ids] : null);
    const p:any={...f,platform,developer_ids:devIds,developer_id:null};
    if(editId)await supabase.from('dev_items').update(p).eq('id',editId);
    else{delete p.review_status;await supabase.from('dev_items').insert(p);for(const cp of crossWith){await supabase.from('dev_items').insert({...p,platform:cp});}}
    ss(false);onSaved();
  };
  const crossBar=!editId&&<div className="flex items-center gap-2">{OTHER_PLATFORMS.map(cp=><label key={cp} className="flex items-center gap-1.5 cursor-pointer select-none"><input type="checkbox" checked={crossWith.includes(cp)} onChange={e=>setCrossWith(prev=>e.target.checked?[...prev,cp]:prev.filter(x=>x!==cp))} className="w-4 h-4 rounded accent-blue-500"/><span className={`text-xs font-bold px-2 py-0.5 rounded ${crossWith.includes(cp)?'bg-blue-600 text-white':'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-300'}`}>{cp} 함께</span></label>)}</div>||undefined;
  return(<Modal title={editId?'개발항목 수정':'개발항목 추가'} onClose={onClose} headerExtra={crossBar}><div className="p-6 space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <VerSel l="버전" v={f.version} c={v=>sf(p=>({...p,version:v}))} versions={versionList} defaultVer={defaultVersion}/>
      <Inp l="항목명 *" v={f.menu_item} c={v=>sf(p=>({...p,menu_item:v}))}/>
    </div>
    <Inp l="상세설명" v={f.description} c={v=>sf(p=>({...p,description:v}))} multi/>
    <div className="grid grid-cols-2 gap-4"><Inp l="부서" v={f.department} c={()=>{}} disabled/><Inp l="담당자" v={f.requester} c={v=>sf(p=>({...p,requester:v}))}/></div>
    <DevSel l="개발담당" v={f.developer_ids} c={v=>sf(p=>({...p,developer_ids:v}))} devs={devTeam}/>
    <div className="grid grid-cols-2 gap-4">
      <Sel l="상태" v={f.dev_status} c={v=>sf(p=>({...p,dev_status:v as DevStatus}))} opts={['대기','개발중','개발완료','배포완료','보류'].map(s=>({v:s,l:s}))}/>
      {editId && <Sel l="검수상태" v={f.review_status} c={v=>sf(p=>({...p,review_status:v as ReviewStatus}))} opts={['검수전','검수중','검수완료'].map(s=>({v:s,l:s}))}/>}
    </div>
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-600 mb-1">📎 참고 링크</label>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={f.planning_link_name} onChange={e=>sf(p=>({...p,planning_link_name:e.target.value}))} placeholder="링크 이름 (예: 기획서)" className="w-full border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
        <input type="text" value={f.planning_link_url} onChange={e=>sf(p=>({...p,planning_link_url:e.target.value}))} placeholder="URL 입력" className="w-full border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
      </div>
    </div>
    <label className="flex items-center gap-2.5 text-sm font-bold cursor-pointer select-none"><input type="checkbox" checked={f.is_required} onChange={e=>sf(p=>({...p,is_required:e.target.checked}))} className="w-5 h-5 rounded border-2 border-red-400 text-red-600 focus:ring-red-500 accent-red-600"/><span className={`px-2 py-0.5 rounded-md ${f.is_required ? "bg-red-600 text-white" : "text-neutral-400 dark:text-neutral-300"}`}>{f.is_required ? "⚡ 필수 항목" : "필수 항목"}</span></label>
    <Inp l="비고" v={f.note} c={v=>sf(p=>({...p,note:v}))} multi/>
  </div><Foot editId={editId} onDel={()=>onDel(editId)} onClose={onClose} onSave={save} saving={saving}/></Modal>);
}

/* ============ BugForm ============ */
function BugForm({supabase,devTeam,editId,table,hasPlatform,defaultVersion,versionList,userName,userDept,onClose,onSaved,onDel}:any){
  const [f,sf]=useState({platform:hasPlatform||'AOS',version:defaultVersion||'',location:'',description:'',priority:'보통' as Priority,department:userDept||'',reporter:userName||'',developer_ids:'',fix_status:'미수정' as FixStatus,review_status:'검수전' as ReviewStatus,planning_link_name:'',planning_link_url:'',note:''});
  const [saving,ss]=useState(false);
  useEffect(()=>{if(!editId){sf(p=>({...p,reporter:p.reporter||userName,department:p.department||userDept}));}},[userName,userDept,editId]);
  useEffect(()=>{if(editId)supabase.from(table).select('*').eq('id',editId).single().then(({data}:any)=>{if(data)sf({platform:data.platform||hasPlatform||'AOS',version:data.version||'',location:data.location||'',description:data.description||'',priority:data.priority||'보통',department:data.department||'',reporter:data.reporter||'',developer_ids:data.developer_ids||data.developer_id||'',fix_status:data.fix_status||'미수정',review_status:data.review_status||'검수전',planning_link_name:data.planning_link_name||'',planning_link_url:data.planning_link_url||'',note:data.note||''});});},[editId]);
  const BUG_OTHER = hasPlatform==='AOS'?['iOS']:hasPlatform==='iOS'?['AOS']:[];
  const [bugCross,setBugCross]=useState<string[]>([]);
  const save=async()=>{
    if(!f.location.trim()){alert('위치 필수');return;}
    ss(true);
    const bugDevIds = Array.isArray(f.developer_ids) ? (f.developer_ids.length > 0 ? f.developer_ids : null) : (f.developer_ids && f.developer_ids !== '' ? [f.developer_ids] : null);
    const p:any={...f,developer_ids:bugDevIds,developer_id:null};
    if(table!=='bug_items')delete p.platform;
    if(table==='bug_items'&&hasPlatform)p.platform=hasPlatform;
    if(!editId) delete p.review_status;
    if(editId)await supabase.from(table).update(p).eq('id',editId);
    else{await supabase.from(table).insert(p);for(const cp of bugCross){await supabase.from(table).insert({...p,platform:cp});}}
    ss(false);onSaved();
  };
  const bugBar=!editId&&BUG_OTHER.length>0&&<div className="flex items-center gap-2">{BUG_OTHER.map(cp=><label key={cp} className="flex items-center gap-1.5 cursor-pointer select-none"><input type="checkbox" checked={bugCross.includes(cp)} onChange={e=>setBugCross(prev=>e.target.checked?[...prev,cp]:prev.filter(x=>x!==cp))} className="w-4 h-4 rounded accent-blue-500"/><span className={`text-xs font-bold px-2 py-0.5 rounded ${bugCross.includes(cp)?'bg-blue-600 text-white':'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-300'}`}>{cp} 함께</span></label>)}</div>||undefined;
  return(<Modal title={editId?'오류 수정':'오류 추가'} onClose={onClose} headerExtra={bugBar}><div className="p-6 space-y-4">
    <div className="grid grid-cols-2 gap-4">
      {hasPlatform?<Inp l="플랫폼" v={hasPlatform} c={()=>{}} disabled/>:
       table==='bug_items'?<Sel l="플랫폼" v={f.platform} c={v=>sf(p=>({...p,platform:v}))} opts={[{v:'AOS',l:'AOS'},{v:'iOS',l:'iOS'}]}/>:
       <Inp l="유형" v={table==='common_bugs'?'공통 오류':'서버 오류'} c={()=>{}} disabled/>}
      <VerSel l="버전" v={f.version} c={v=>sf(p=>({...p,version:v}))} versions={versionList} defaultVer={defaultVersion}/>
    </div>
    <Inp l="이슈 위치 *" v={f.location} c={v=>sf(p=>({...p,location:v}))}/>
    <Inp l="상세설명" v={f.description} c={v=>sf(p=>({...p,description:v}))} multi/>
    <div className="grid grid-cols-2 gap-4">
      <Sel l="우선순위" v={f.priority} c={v=>sf(p=>({...p,priority:v as Priority}))} opts={['긴급','높음','보통','낮음'].map(s=>({v:s,l:s}))}/>
      <Inp l="보고자" v={f.reporter} c={()=>{}} disabled/>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <Inp l="부서" v={f.department} c={()=>{}} disabled/>
      <DevSel l="개발담당" v={f.developer_ids} c={v=>sf(p=>({...p,developer_ids:v}))} devs={devTeam}/>
    </div>
    <Sel l="수정결과" v={f.fix_status} c={v=>sf(p=>({...p,fix_status:v as FixStatus}))} opts={['미수정','수정중','수정완료','배포완료','보류'].map(s=>({v:s,l:s}))}/>
    {editId && <Sel l="검수상태" v={f.review_status} c={v=>sf(p=>({...p,review_status:v as ReviewStatus}))} opts={['검수전','검수중','검수완료'].map(s=>({v:s,l:s}))}/>}
    <div><label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">📎 참고 링크</label><div className="grid grid-cols-2 gap-2"><input type="text" value={f.planning_link_name} onChange={e=>sf(p=>({...p,planning_link_name:e.target.value}))} placeholder="링크 이름 (예: 기획서)" className="w-full border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm"/><input type="text" value={f.planning_link_url} onChange={e=>sf(p=>({...p,planning_link_url:e.target.value}))} placeholder="URL 입력" className="w-full border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm"/></div></div>
    <Inp l="비고" v={f.note} c={v=>sf(p=>({...p,note:v}))} multi/>
  </div><Foot editId={editId} onDel={()=>onDel(editId)} onClose={onClose} onSave={save} saving={saving}/></Modal>);
}

/* ============ Shared UI ============ */
function Modal({title,onClose,children,headerExtra}:{title:string;onClose:()=>void;children:React.ReactNode;headerExtra?:React.ReactNode}){return(
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}><div className="bg-white dark:bg-neutral-900 rounded-lg border-2 border-black dark:border-neutral-600 shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:shadow-[6px_6px_0_0_rgba(255,255,255,0.05)] w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
    <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700"><h2 className="font-bold text-lg text-neutral-900 dark:text-white">{title}</h2><div className="flex items-center gap-3">{headerExtra}{<button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-200"><X size={20}/></button>}</div></div>{children}</div></div>);}
function Foot({editId,onDel,onClose,onSave,saving}:any){return(
  <div className="flex justify-between px-6 py-4 border-t bg-gray-50">{editId?<button onClick={onDel} className="text-red-500 hover:text-red-700 text-sm font-medium">삭제</button>:<div/>}
    <div className="flex gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button><button onClick={onSave} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving?'저장중...':editId?'수정':'추가'}</button></div></div>);}
function Inp({l,v,c,ph,multi,disabled}:{l:string;v:string;c:(v:string)=>void;ph?:string;multi?:boolean;disabled?:boolean}){
  const cls="w-full border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500";
  return(<div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>{multi?<textarea value={v} onChange={e=>c(e.target.value)} placeholder={ph} rows={3} className={cls} disabled={disabled}/>:<input type="text" value={v} onChange={e=>c(e.target.value)} placeholder={ph} className={cls} disabled={disabled}/>}</div>);}
function Sel({l,v,c,opts}:{l:string;v:string;c:(v:string)=>void;opts:{v:string;l:string}[]}){return(
  <div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label><select value={v} onChange={e=>c(e.target.value)} className="w-full border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">{opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></div>);}

function VerSel({l,v,c,versions,defaultVer}:{l:string;v:string;c:(v:string)=>void;versions:string[];defaultVer?:string}){
  const mainVer = defaultVer || versions[0] || '';
  const otherVers = versions.filter(ver=>ver!==mainVer);
  return(
    <div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
      <select value={v} onChange={e=>c(e.target.value)} className="w-full border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
        {mainVer && <option value={mainVer}>{mainVer} (현재)</option>}
        {v && v!==mainVer && !versions.includes(v) && <option value={v}>{v}</option>}
        {otherVers.length>0 && <option disabled>── 다른 버전 ──</option>}
        {otherVers.map(ver=><option key={ver} value={ver}>{ver}</option>)}
      </select>
    </div>);}

/* ============ DevSel - 개발담당 멀티셀렉트 (팀 전체선택 지원) ============ */
function DevSel({l,v,c,devs}:{l:string;v:string;c:(v:string)=>void;devs:any[]}){
  const [open,setOpen]=useState(false);
  const ref=useRef<HTMLDivElement>(null);
  const selectedIds = v ? v.split(',').filter(Boolean) : [];
  const toggle = (id:string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter(x=>x!==id) : [...selectedIds,id];
    c(next.join(','));
  };
  const toggleGroup = (ids:string[]) => {
    const allSelected = ids.every(id=>selectedIds.includes(id));
    const next = allSelected ? selectedIds.filter(x=>!ids.includes(x)) : Array.from(new Set([...selectedIds,...ids]));
    c(next.join(','));
    setOpen(false);
  };
  const groups:{label:string;items:any[]}[] = [
    {label:'AOS팀', items:devs.filter(d=>d.department==='개발팀'&&d.platform==='AOS')},
    {label:'iOS팀', items:devs.filter(d=>d.department==='개발팀'&&d.platform==='iOS')},
    {label:'서버팀', items:devs.filter(d=>d.department==='서버(백앤드)'||d.department==='서버(시스템)')},
    {label:'QA팀', items:devs.filter(d=>d.platform==='QA')},
  ].filter(g=>g.items.length>0);
  const names = selectedIds.map(id=>devs.find(d=>d.id===id)?.name).filter(Boolean);

  useEffect(()=>{
    const handler=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false);};
    document.addEventListener('mousedown',handler);return()=>document.removeEventListener('mousedown',handler);
  },[]);

  return(
    <div ref={ref} className="relative"><label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">{l}</label>
      <button type="button" onClick={()=>setOpen(!open)} className="w-full border-2 border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 rounded-lg px-3 py-2 text-sm text-left font-medium focus:border-black dark:focus:border-white focus:outline-none flex items-center justify-between">
        <span className={names.length?'text-black dark:text-white':'text-neutral-400'}>{names.length ? names.join(', ') : '미배정'}</span>
        <ChevronDown size={14} className={`transition ${open?'rotate-180':''}`}/>
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-600 rounded-lg shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:shadow-[3px_3px_0_0_rgba(255,255,255,0.05)] max-h-64 overflow-y-auto">
          <button type="button" onClick={()=>{c('');setOpen(false);}} className={`w-full text-left px-3 py-2 text-sm font-medium border-b border-neutral-200 dark:border-neutral-700 ${selectedIds.length===0?'bg-black text-white dark:bg-white dark:text-black':'hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}>미배정</button>
          {groups.map(g=>{
            const gIds=g.items.map(d=>d.id);
            const allSel=gIds.every(id=>selectedIds.includes(id));
            return(<div key={g.label}>
              <button type="button" onClick={()=>toggleGroup(gIds)} className={`w-full text-left px-3 py-2 text-xs font-black uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between ${allSel?'bg-neutral-900 text-white dark:bg-white dark:text-black':'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}>
                <span>{g.label} 전체</span>
                <span className="text-[10px] font-bold">{allSel?'✓ 선택됨':`${g.items.length}명`}</span>
              </button>
              {g.items.map(d=>(
                <button type="button" key={d.id} onClick={()=>toggle(d.id)} className={`w-full text-left px-3 pl-6 py-2 text-sm font-medium border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-2 ${selectedIds.includes(d.id)?'bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white':'hover:bg-neutral-50 dark:hover:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300'}`}>
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] ${selectedIds.includes(d.id)?'bg-black dark:bg-white border-black dark:border-white text-white dark:text-black':'border-neutral-300 dark:border-neutral-600'}`}>{selectedIds.includes(d.id)?'✓':''}</span>
                  {d.name} <span className="text-neutral-400 text-xs">({d.role})</span>
                </button>
              ))}
            </div>);
          })}
        </div>
      )}
    </div>);}
