'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import DataTable from '@/components/table/DataTable';
import { StatusBadge, PriorityTag } from '@/components/common/StatusBadge';
import { Send, Plus, X, ArrowRightLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useVersion } from '@/components/layout/Header';
import type { DevStatus, FixStatus, Priority, ReviewStatus } from '@/lib/types/database';

const PLATFORM = 'iOS';
const EXCLUDED_ROLES = ['CTO','상무이사','이사'];
const EXCLUDED_DEPTS = ['서버(시스템)','재무','데이터/광고','AIAE','운영'];

export default function IosPage() {
  const supabase = createClient();
  const { iosVersion: selectedVer, iosVersions: allVersions, userName, userDept } = useVersion();
  const [rawDev, setRawDev] = useState<any[]>([]);
  const [rawBug, setRawBug] = useState<any[]>([]);
  const [rawCommon, setRawCommon] = useState<any[]>([]);
  const [rawServer, setRawServer] = useState<any[]>([]);
  const [developers, setDevelopers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<{type:'dev'|'bug'|'common'|'server';id?:string}|null>(null);
  const [collapsed, setCollapsed] = useState<Record<string,boolean>>({});

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
      ? ['대기','개발중','보류','검수요청']
      : ['미수정','수정중','보류'];
    const carried = items
      .filter(i => olderVers.includes(i.version) && incomplete.includes(i[statusField]))
      .map(i => ({ ...i, _carried: true, _origVer: i.version }));
    return [...thisVer, ...carried];
  }, [selectedVer, allVersions]);

  const devItems = useMemo(() => filterVer(rawDev, 'dev_status'), [rawDev, filterVer]);
  const bugItems = useMemo(() => filterVer(rawBug, 'fix_status'), [rawBug, filterVer]);
  const commonItems = useMemo(() => filterVer(rawCommon, 'fix_status'), [rawCommon, filterVer]);
  const serverItems = useMemo(() => filterVer(rawServer, 'fix_status'), [rawServer, filterVer]);

  const toggle = (k:string) => setCollapsed(p=>({...p,[k]:!p[k]}));
  const closeForm=()=>setShowForm(null);
  const afterSave=()=>{closeForm();loadData();};

  const CarriedBadge = ({item}:{item:any}) => item._carried ? (
    <span className="inline-flex items-center gap-0.5 text-[10px] bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300 px-1.5 py-0.5 rounded-full font-medium ml-1">
      <ArrowRightLeft size={9}/>{item._origVer}
    </span>
  ) : null;

  const [selDev, setSelDev] = useState<Set<string>>(new Set());
  const [selBug, setSelBug] = useState<Set<string>>(new Set());
  const [selCommon, setSelCommon] = useState<Set<string>>(new Set());
  const [selServer, setSelServer] = useState<Set<string>>(new Set());

  const getDevNames = (item:any) => {
    if (!item.developer_id) return <span className="text-neutral-300 dark:text-neutral-600">-</span>;
    if (typeof item.developer_id === 'string') {
      const dev = developers.find(d=>d.id===item.developer_id);
      return dev ? dev.name : <span className="text-neutral-300 dark:text-neutral-600">-</span>;
    }
    return item.developers?.name || <span className="text-neutral-300 dark:text-neutral-600">-</span>;
  };

  // 검수상태 인라인 변경
  const handleReviewChange = async(table:string, id:string, val:ReviewStatus) => {
    await supabase.from(table).update({review_status:val}).eq('id',id);
    loadData();
  };

  const ReviewSel = ({item,table}:{item:any;table:string}) => (
    <select value={item.review_status||'검수전'} onChange={e=>handleReviewChange(table,item.id,e.target.value as ReviewStatus)}
      className="text-xs border border-neutral-200 dark:border-neutral-800 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-neutral-400"
      onClick={e=>e.stopPropagation()}>
      <option value="검수전">검수전</option>
      <option value="검수중">검수중</option>
      <option value="검수완료">검수완료</option>
    </select>
  );

  // 검수완료 시 취소선
  const isReviewed = (item:any) => item.fix_status==='수정완료' && item.review_status==='검수완료';

  const devCols = [
    {key:'version',label:'버전',width:'w-28',sortable:true, render:(i:any)=><div className="flex items-center">{i.version}<CarriedBadge item={i}/></div>},
    {key:'menu_item',label:'항목',sortable:true,render:(i:any)=><button onClick={()=>setShowForm({type:'dev',id:i.id})} className="text-neutral-900 dark:text-white hover:underline font-medium text-left">{i.menu_item}</button>},
    {key:'description',label:'설명',width:'max-w-xs',render:(i:any)=><span className="text-neutral-500 dark:text-neutral-400 text-xs line-clamp-1">{i.description||'-'}</span>},
    {key:'is_required',label:'필수',width:'w-12',align:'center' as const,render:(i:any)=>i.is_required?<span className="text-xs font-bold text-red-600 dark:text-red-400">Y</span>:<span className="text-neutral-300 dark:text-neutral-600">-</span>},
    {key:'department',label:'부서',width:'w-16',align:'center' as const,render:(i:any)=><span className="text-xs">{i.department||'-'}</span>},
    {key:'developer',label:'개발담당',width:'w-24',align:'center' as const,render:(i:any)=>getDevNames(i)},
    {key:'dev_status',label:'상태',width:'w-24',sortable:true,align:'center' as const,render:(i:any)=><StatusBadge status={i.dev_status} type="dev"/>},
    {key:'send_status',label:'전송',width:'w-20',align:'center' as const,render:(i:any)=><StatusBadge status={i.send_status} type="send"/>},
  ];

  const bugCols = [
    {key:'version',label:'버전',width:'w-28',sortable:true, render:(i:any)=><div className="flex items-center">{i.version}<CarriedBadge item={i}/></div>},
    {key:'priority',label:'우선순위',width:'w-20',sortable:true,align:'center' as const,render:(i:any)=><PriorityTag priority={i.priority}/>},
    {key:'location',label:'위치',sortable:true,render:(i:any)=><button onClick={()=>setShowForm({type:'bug',id:i.id})} className={`text-neutral-900 dark:text-white hover:underline font-medium text-left ${isReviewed(i)?'line-through decoration-red-500 text-neutral-400 dark:text-neutral-600':''}`}>{i.location}</button>},
    {key:'description',label:'설명',width:'max-w-xs',render:(i:any)=><span className={`text-neutral-500 dark:text-neutral-400 text-xs line-clamp-1 ${isReviewed(i)?'line-through decoration-red-500':''}`}>{i.description||'-'}</span>},
    {key:'developer',label:'개발담당',width:'w-24',align:'center' as const,render:(i:any)=>getDevNames(i)},
    {key:'fix_status',label:'수정결과',width:'w-24',sortable:true,align:'center' as const,render:(i:any)=><StatusBadge status={i.fix_status} type="fix"/>},
    {key:'review_status',label:'검수',width:'w-24',align:'center' as const,render:(i:any)=><ReviewSel item={i} table="bug_items"/>},
    {key:'send_status',label:'전송',width:'w-20',align:'center' as const,render:(i:any)=><StatusBadge status={i.send_status} type="send"/>},
  ];

  const commonCols = bugCols.map(c=>{
    if(c.key==='location') return {...c,render:(i:any)=><button onClick={()=>setShowForm({type:'common',id:i.id})} className={`text-neutral-900 dark:text-white hover:underline font-medium text-left ${isReviewed(i)?'line-through decoration-red-500 text-neutral-400 dark:text-neutral-600':''}`}>{i.location}</button>};
    if(c.key==='review_status') return {...c,render:(i:any)=><ReviewSel item={i} table="common_bugs"/>};
    return c;
  });
  const serverCols = bugCols.map(c=>{
    if(c.key==='location') return {...c,render:(i:any)=><button onClick={()=>setShowForm({type:'server',id:i.id})} className={`text-neutral-900 dark:text-white hover:underline font-medium text-left ${isReviewed(i)?'line-through decoration-red-500 text-neutral-400 dark:text-neutral-600':''}`}>{i.location}</button>};
    if(c.key==='review_status') return {...c,render:(i:any)=><ReviewSel item={i} table="server_bugs"/>};
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

  const handleDel = async(type:string,id:string)=>{
    if(!confirm('삭제할까요?'))return;
    const tbl = type==='dev'?'dev_items':type==='bug'?'bug_items':type==='common'?'common_bugs':'server_bugs';
    await supabase.from(tbl).delete().eq('id',id);
    afterSave();
  };

  const SectionHeader = ({title,count,color,sectionKey,onAdd}:{title:string;count:number;color:string;sectionKey:string;onAdd:()=>void}) => (
    <div className={`flex items-center justify-between py-3 px-4 ${color} rounded-t-xl cursor-pointer select-none`} onClick={()=>toggle(sectionKey)}>
      <div className="flex items-center gap-2">
        {collapsed[sectionKey]?<ChevronDown size={16} className="text-white/70"/>:<ChevronUp size={16} className="text-white/70"/>}
        <h2 className="text-sm font-bold text-white">{title}</h2>
        <span className="text-xs text-white/70 bg-white/20 px-2 py-0.5 rounded-full">{count}건</span>
      </div>
      <button onClick={(e)=>{e.stopPropagation();onAdd();}} className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-lg transition">+ 추가</button>
    </div>
  );

  const SendBar = ({ids,onSend}:{ids:Set<string>;onSend:()=>void}) => ids.size > 0 ? (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-neutral-100 dark:border-neutral-800">
      <button onClick={onSend} className="flex items-center gap-1 bg-neutral-900 dark:bg-white dark:text-black text-white text-xs px-3 py-1.5 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-200">
        <Send size={12}/>선택 전송 ({ids.size})
      </button>
    </div>
  ) : null;

  const versionList = allVersions.map(v => v.version);

  return (<div className="space-y-6">
    <div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">iOS</h1>
      {selectedVer && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">선택 버전: <span className="font-semibold text-gray-700">{selectedVer}</span></p>}
    </div>

    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      <SectionHeader title="📋 개발항목" count={devItems.length} color="bg-neutral-900 dark:bg-neutral-800" sectionKey="dev" onAdd={()=>setShowForm({type:'dev'})}/>
      {!collapsed.dev && <DataTable data={devItems} columns={devCols} selectable selectedIds={selDev} onSelectionChange={setSelDev}
        searchKeys={['menu_item','description','department']} searchPlaceholder="개발항목 검색..." emptyMessage={loading?'로딩 중...':'등록된 항목 없음'}
        toolbar={<SendBar ids={selDev} onSend={()=>handleSend('dev',selDev)}/>}/>}
    </div>

    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      <SectionHeader title="🐛 앱 오류" count={bugItems.length} color="bg-neutral-800 dark:bg-neutral-800" sectionKey="bug" onAdd={()=>setShowForm({type:'bug'})}/>
      {!collapsed.bug && <DataTable data={bugItems} columns={bugCols} selectable selectedIds={selBug} onSelectionChange={setSelBug}
        searchKeys={['location','description','reporter']} searchPlaceholder="앱 오류 검색..." emptyMessage={loading?'로딩 중...':'등록된 오류 없음'}
        toolbar={<SendBar ids={selBug} onSend={()=>handleSend('bug',selBug)}/>}/>}
    </div>

    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      <SectionHeader title="⚠️ 공통 오류" count={commonItems.length} color="bg-neutral-700 dark:bg-neutral-800" sectionKey="common" onAdd={()=>setShowForm({type:'common'})}/>
      {!collapsed.common && <DataTable data={commonItems} columns={commonCols} selectable selectedIds={selCommon} onSelectionChange={setSelCommon}
        searchKeys={['location','description']} searchPlaceholder="공통 오류 검색..." emptyMessage={loading?'로딩 중...':'등록된 오류 없음'}
        toolbar={<SendBar ids={selCommon} onSend={()=>handleSend('common',selCommon)}/>}/>}
    </div>

    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      <SectionHeader title="🖥️ 서버 오류" count={serverItems.length} color="bg-neutral-600 dark:bg-neutral-800" sectionKey="server" onAdd={()=>setShowForm({type:'server'})}/>
      {!collapsed.server && <DataTable data={serverItems} columns={serverCols} selectable selectedIds={selServer} onSelectionChange={setSelServer}
        searchKeys={['location','description']} searchPlaceholder="서버 오류 검색..." emptyMessage={loading?'로딩 중...':'등록된 오류 없음'}
        toolbar={<SendBar ids={selServer} onSend={()=>handleSend('server',selServer)}/>}/>}
    </div>

    {showForm?.type==='dev'&&<DevForm supabase={supabase} devTeam={devTeam} editId={showForm.id} platform={PLATFORM} defaultVersion={selectedVer} versionList={versionList} userName={userName} userDept={userDept} onClose={closeForm} onSaved={afterSave} onDel={(id:string)=>handleDel('dev',id)}/>}
    {showForm?.type==='bug'&&<BugForm supabase={supabase} devTeam={devTeam} editId={showForm.id} table="bug_items" hasPlatform={PLATFORM} defaultVersion={selectedVer} versionList={versionList} userName={userName} userDept={userDept} onClose={closeForm} onSaved={afterSave} onDel={(id:string)=>handleDel('bug',id)}/>}
    {showForm?.type==='common'&&<BugForm supabase={supabase} devTeam={devTeam} editId={showForm.id} table="common_bugs" defaultVersion={selectedVer} versionList={versionList} userName={userName} userDept={userDept} onClose={closeForm} onSaved={afterSave} onDel={(id:string)=>handleDel('common',id)}/>}
    {showForm?.type==='server'&&<BugForm supabase={supabase} devTeam={devTeam} editId={showForm.id} table="server_bugs" defaultVersion={selectedVer} versionList={versionList} userName={userName} userDept={userDept} onClose={closeForm} onSaved={afterSave} onDel={(id:string)=>handleDel('server',id)}/>}
  </div>);
}

/* ============ DevForm ============ */
function DevForm({supabase,devTeam,editId,platform,defaultVersion,versionList,userName,userDept,onClose,onSaved,onDel}:any){
  const [f,sf]=useState({version:defaultVersion||'',menu_item:'',description:'',is_required:false,department:userDept||'',requester:userName||'',developer_id:'',dev_status:'대기' as DevStatus,note:''});
  const [saving,ss]=useState(false);
  useEffect(()=>{if(!editId){sf(p=>({...p,requester:p.requester||userName,department:p.department||userDept}));}},[userName,userDept,editId]);
  useEffect(()=>{if(editId)supabase.from('dev_items').select('*').eq('id',editId).single().then(({data}:any)=>{if(data)sf({version:data.version||'',menu_item:data.menu_item||'',description:data.description||'',is_required:data.is_required||false,department:data.department||'',requester:data.requester||'',developer_id:data.developer_id||'',dev_status:data.dev_status||'대기',note:data.note||''});});},[editId]);
  const save=async()=>{if(!f.menu_item.trim()){alert('항목명 필수');return;}ss(true);const p={...f,platform,developer_id:f.developer_id||null};if(editId)await supabase.from('dev_items').update(p).eq('id',editId);else await supabase.from('dev_items').insert(p);ss(false);onSaved();};
  return(<Modal title={editId?'개발항목 수정':'개발항목 추가'} onClose={onClose}><div className="p-6 space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <VerSel l="버전" v={f.version} c={v=>sf(p=>({...p,version:v}))} versions={versionList} defaultVer={defaultVersion}/>
      <Inp l="항목명 *" v={f.menu_item} c={v=>sf(p=>({...p,menu_item:v}))}/>
    </div>
    <Inp l="상세설명" v={f.description} c={v=>sf(p=>({...p,description:v}))} multi/>
    <div className="grid grid-cols-2 gap-4"><Inp l="부서" v={f.department} c={()=>{}} disabled/><Inp l="담당자" v={f.requester} c={v=>sf(p=>({...p,requester:v}))}/></div>
    <DevSel l="개발담당" v={f.developer_id} c={v=>sf(p=>({...p,developer_id:v}))} devs={devTeam}/>
    <Sel l="상태" v={f.dev_status} c={v=>sf(p=>({...p,dev_status:v as DevStatus}))} opts={['대기','개발중','개발완료','검수요청','보류'].map(s=>({v:s,l:s}))}/>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_required} onChange={e=>sf(p=>({...p,is_required:e.target.checked}))} className="rounded"/>필수 항목</label>
    <Inp l="비고" v={f.note} c={v=>sf(p=>({...p,note:v}))} multi/>
  </div><Foot editId={editId} onDel={()=>onDel(editId)} onClose={onClose} onSave={save} saving={saving}/></Modal>);
}

/* ============ BugForm ============ */
function BugForm({supabase,devTeam,editId,table,hasPlatform,defaultVersion,versionList,userName,userDept,onClose,onSaved,onDel}:any){
  const [f,sf]=useState({platform:hasPlatform||'AOS',version:defaultVersion||'',location:'',description:'',priority:'보통' as Priority,department:userDept||'',reporter:userName||'',developer_id:'',fix_status:'미수정' as FixStatus,review_status:'검수전' as ReviewStatus,note:''});
  const [saving,ss]=useState(false);
  useEffect(()=>{if(!editId){sf(p=>({...p,reporter:p.reporter||userName,department:p.department||userDept}));}},[userName,userDept,editId]);
  useEffect(()=>{if(editId)supabase.from(table).select('*').eq('id',editId).single().then(({data}:any)=>{if(data)sf({platform:data.platform||hasPlatform||'AOS',version:data.version||'',location:data.location||'',description:data.description||'',priority:data.priority||'보통',department:data.department||'',reporter:data.reporter||'',developer_id:data.developer_id||'',fix_status:data.fix_status||'미수정',review_status:data.review_status||'검수전',note:data.note||''});});},[editId]);
  const save=async()=>{
    if(!f.location.trim()){alert('위치 필수');return;}
    ss(true);
    const p:any={...f,developer_id:f.developer_id||null};
    if(table!=='bug_items')delete p.platform;
    if(table==='bug_items'&&hasPlatform)p.platform=hasPlatform;
    // 새 등록 시 review_status 제외 (DB default 사용)
    if(!editId) delete p.review_status;
    if(editId)await supabase.from(table).update(p).eq('id',editId);
    else await supabase.from(table).insert(p);
    ss(false);onSaved();
  };
  return(<Modal title={editId?'오류 수정':'오류 추가'} onClose={onClose}><div className="p-6 space-y-4">
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
      <DevSel l="개발담당" v={f.developer_id} c={v=>sf(p=>({...p,developer_id:v}))} devs={devTeam}/>
    </div>
    <Sel l="수정결과" v={f.fix_status} c={v=>sf(p=>({...p,fix_status:v as FixStatus}))} opts={['미수정','수정중','수정완료','보류'].map(s=>({v:s,l:s}))}/>
    {editId && <Sel l="검수상태" v={f.review_status} c={v=>sf(p=>({...p,review_status:v as ReviewStatus}))} opts={['검수전','검수중','검수완료'].map(s=>({v:s,l:s}))}/>}
    <Inp l="비고" v={f.note} c={v=>sf(p=>({...p,note:v}))} multi/>
  </div><Foot editId={editId} onDel={()=>onDel(editId)} onClose={onClose} onSave={save} saving={saving}/></Modal>);
}

/* ============ Shared UI ============ */
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){return(
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}><div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
    <div className="flex items-center justify-between px-6 py-4 border-b"><h2 className="font-bold text-lg">{title}</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button></div>{children}</div></div>);}
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

/* ============ DevSel - 개발담당 (AOS/iOS/서버 그룹핑) ============ */
function DevSel({l,v,c,devs}:{l:string;v:string;c:(v:string)=>void;devs:any[]}){
  const groups:{label:string;items:any[]}[] = [
    {label:'AOS', items:devs.filter(d=>d.department==='개발팀'&&d.platform==='AOS')},
    {label:'iOS', items:devs.filter(d=>d.department==='개발팀'&&d.platform==='iOS')},
    {label:'서버', items:devs.filter(d=>d.department==='서버(백앤드)')},
  ].filter(g=>g.items.length>0);
  return(
    <div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
      <select value={v} onChange={e=>c(e.target.value)} className="w-full border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
        <option value="">미배정</option>
        {groups.map(g=>(
          <optgroup key={g.label} label={`── ${g.label} ──`}>
            {g.items.map(d=><option key={d.id} value={d.id}>{d.name} ({d.role})</option>)}
          </optgroup>
        ))}
      </select>
    </div>);}
