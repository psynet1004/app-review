'use client';
import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useVersion } from '@/components/layout/Header';
import type { DevStatus, ReviewStatus } from '@/lib/types/database';
import type { ChecklistItem } from '@/components/common/ChecklistModal';
import { ChevronLeft, ChevronDown, Plus, Trash2, Lock, AlertTriangle } from 'lucide-react';

const PLATFORM = 'SERVER';
const EXCLUDED_ROLES = ['CTO','상무이사','이사'];
const EXCLUDED_DEPTS = ['서버(시스템)','재무','데이터/광고','AIAE','운영'];
const CATEGORY_LABEL: Record<string,string> = { 'PM':'기획', '서버':'서버', '모바일':'모바일' };
const CATEGORY_COLOR: Record<string,string> = {
  'PM':   'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  '서버': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  '모바일':'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
};

function groupByCategory(items: ChecklistItem[]) {
  const map = new Map<string, { sub: Map<string, ChecklistItem[]> }>();
  for (const item of items) {
    if (!map.has(item.category)) map.set(item.category, { sub: new Map() });
    const subKey = item.sub_category || '__none__';
    const cat = map.get(item.category)!;
    if (!cat.sub.has(subKey)) cat.sub.set(subKey, []);
    cat.sub.get(subKey)!.push(item);
  }
  return map;
}

export default function ServerItemPageWrapper(){
  return <Suspense fallback={null}><ServerItemPage/></Suspense>;
}

function ServerItemPage(){
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get('id') || undefined;
  const { serverVersion: selectedVer, serverVersions: allVersions, userName, userDept, userEmail } = useVersion();
  const isPM = userEmail === 'boongss@psynet.co.kr' || userDept === '운영' || userDept === 'PM';
  const versionList = useMemo(()=>allVersions.map((v:any)=>v.version),[allVersions]);

  const [developers,setDevelopers]=useState<any[]>([]);
  useEffect(()=>{supabase.from('developers').select('*').eq('is_active',true).then(({data}:any)=>setDevelopers(data||[]));},[]);
  const devTeam = useMemo(()=>developers.filter(d=>
    ['개발팀','서버(백앤드)'].includes(d.department) &&
    !EXCLUDED_ROLES.includes(d.role) &&
    !EXCLUDED_DEPTS.includes(d.department)
  ),[developers]);

  const [f,sf]=useState({version:selectedVer||'',menu_item:'',description:'',is_required:false,department:userDept||'',requester:userName||'',developer_ids:'',dev_status:'대기' as DevStatus,review_status:'검수전' as ReviewStatus,planning_link_url:'',planning_link_name:'',note:''});
  const [saving,setSaving]=useState(false);
  const [loading,setLoading]=useState(!!editId);
  const OTHER_PLATFORMS = ['AOS','iOS'];
  const [crossWith,setCrossWith]=useState<string[]>([]);

  useEffect(()=>{if(!editId){sf(p=>({...p,requester:p.requester||userName,department:p.department||userDept,version:p.version||selectedVer||''}));}},[userName,userDept,selectedVer,editId]);
  useEffect(()=>{if(editId){
    supabase.from('dev_items').select('*').eq('id',editId).single().then(({data}:any)=>{
      if(data)sf({version:data.version||'',menu_item:data.menu_item||'',description:data.description||'',is_required:data.is_required||false,department:data.department||'',requester:data.requester||'',developer_ids:data.developer_ids||data.developer_id||'',dev_status:data.dev_status||'대기',review_status:data.review_status||'검수전',planning_link_name:data.planning_link_name||'',planning_link_url:data.planning_link_url||'',note:data.note||''});
      setLoading(false);
    });
  }},[editId]);

  // ── 체크리스트 구성 (체크 없음, 구성만) ──────────────────────
  const [items,setItems]=useState<ChecklistItem[]>([]);
  const [clLoading,setClLoading]=useState(true);
  const [showAddRow,setShowAddRow]=useState(false);
  const [newLabel,setNewLabel]=useState('');
  const [newSubCategory,setNewSubCategory]=useState('');

  const loadChecklist = useCallback(async()=>{
    setClLoading(true);
    if(editId){
      const {data}=await supabase.from('dev_item_checklists').select('*').eq('dev_item_id',editId).order('sort_order');
      setItems((data||[]) as ChecklistItem[]);
    }else{
      const {data}=await supabase.from('checklist_templates').select('*').eq('is_active',true).order('sort_order');
      setItems((data||[]).map((t:any)=>({template_id:t.id,category:t.category,sub_category:t.sub_category,label:t.label,is_checked:false,sort_order:t.sort_order,isNew:true})));
    }
    setClLoading(false);
  },[editId]);
  useEffect(()=>{loadChecklist();},[loadChecklist]);

  const deleteChecklistItem = async(idx:number)=>{
    const item = items[idx];
    if(item.category!=='PM') return; // 서버/모바일 고정, 삭제 불가
    if(!isPM) return; // 기획 항목도 PM만 삭제 가능
    if(item.id){ await supabase.from('dev_item_checklists').delete().eq('id',item.id); }
    setItems(prev=>prev.filter((_,i)=>i!==idx));
  };
  const addChecklistItem = ()=>{
    if(!newLabel.trim())return;
    const maxOrder = items.length>0 ? Math.max(...items.map(i=>i.sort_order))+10 : 10;
    setItems(prev=>[...prev,{category:'PM',sub_category:newSubCategory||null,label:newLabel.trim(),is_checked:false,sort_order:maxOrder,isNew:true}]);
    setNewLabel('');setNewSubCategory('');setShowAddRow(false);
  };

  const save=async()=>{
    if(!f.menu_item.trim()){alert('항목명 필수');return;}
    setSaving(true);
    const p:any={...f,platform:PLATFORM,developer_ids:f.developer_ids||null,developer_id:null};
    if(editId){
      await supabase.from('dev_items').update(p).eq('id',editId);
      // 신규 추가된 체크리스트만 insert (삭제는 이미 즉시 반영됨)
      const newOnes = items.filter(i=>i.isNew);
      for(const it of newOnes){
        await supabase.from('dev_item_checklists').insert({dev_item_id:editId,template_id:it.template_id||null,category:it.category,sub_category:it.sub_category||null,label:it.label,is_checked:false,sort_order:it.sort_order});
      }
    }else{
      delete p.review_status;
      const {data:newItem}=await supabase.from('dev_items').insert(p).select('id').single();
      if(newItem?.id){
        for(const it of items){
          await supabase.from('dev_item_checklists').insert({dev_item_id:newItem.id,template_id:it.template_id||null,category:it.category,sub_category:it.sub_category||null,label:it.label,is_checked:false,sort_order:it.sort_order});
        }
        for(const cp of crossWith){
          const {data:cpItem}=await supabase.from('dev_items').insert({...p,platform:cp}).select('id').single();
          if(cpItem?.id){for(const it of items){await supabase.from('dev_item_checklists').insert({dev_item_id:cpItem.id,template_id:it.template_id||null,category:it.category,sub_category:it.sub_category||null,label:it.label,is_checked:false,sort_order:it.sort_order});}}
        }
      }
    }
    setSaving(false);
    router.push('/dev/server');
  };

  const onDel = async()=>{
    if(!editId)return;
    if(!confirm('삭제할까요?'))return;
    await supabase.from('dev_items').delete().eq('id',editId);
    router.push('/dev/server');
  };

  const grouped = groupByCategory(items);

  if(loading) return <div className="p-10 text-center text-neutral-400 text-sm">불러오는 중...</div>;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={()=>router.push('/dev/server')} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <ChevronLeft className="w-5 h-5"/>
          </button>
          <h1 className="text-lg font-bold text-neutral-900 dark:text-white">{editId?'개발항목 수정':'개발항목 추가'}</h1>
        </div>
        {!editId && (
          <div className="flex items-center gap-2">
            {OTHER_PLATFORMS.map(cp=>(
              <label key={cp} className="flex items-center gap-1.5 cursor-pointer select-none">
                <input type="checkbox" checked={crossWith.includes(cp)} onChange={e=>setCrossWith(prev=>e.target.checked?[...prev,cp]:prev.filter(x=>x!==cp))} className="w-4 h-4 rounded accent-blue-500"/>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${crossWith.includes(cp)?'bg-blue-600 text-white':'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-300'}`}>{cp} 함께</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 본문: 좌측 기본정보 / 우측 체크리스트 구성 */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
        {/* 좌측: 기본 정보 */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-6 space-y-4 h-fit">
          <div className="grid grid-cols-2 gap-4">
            <VerSel l="버전" v={f.version} c={v=>sf(p=>({...p,version:v}))} versions={versionList} defaultVer={selectedVer}/>
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
        </div>

        {/* 우측: 체크리스트 구성 */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-6 space-y-4 h-fit">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-white">체크리스트 구성</h2>
          <div className="rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600 px-4 py-3 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5"/>
            <div className="text-sm">
              <p className="font-bold text-amber-800 dark:text-amber-300">⚠️ 상용 서비스 오류를 줄이기 위한 최종 확인입니다.</p>
              <p className="text-amber-700 dark:text-amber-400 mt-0.5">각 항목은 실제 배포 품질에 직접 영향을 줍니다.</p>
              <p className="text-amber-700 dark:text-amber-400">한 번 더 경각심을 가지고 꼼꼼히 확인합시다.</p>
            </div>
          </div>

          {clLoading ? (
            <div className="text-center py-10 text-neutral-400 text-sm">불러오는 중...</div>
          ) : (
            <div className="space-y-4">
              {Array.from(grouped.entries()).map(([category,{sub}])=>(
                <div key={category}>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3 ${CATEGORY_COLOR[category]||'bg-neutral-100 text-neutral-600'}`}>
                    {CATEGORY_LABEL[category]||category}
                  </div>
                  <div className="space-y-3">
                    {Array.from(sub.entries()).map(([subKey,subItems])=>(
                      <div key={subKey} className="space-y-1.5">
                        {subKey!=='__none__' && <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 pl-1 mt-2">{subKey}</p>}
                        {subItems.map((item)=>{
                          const globalIdx = items.indexOf(item);
                          const canDelete = item.category==='PM' && isPM;
                          return (
                            <div key={globalIdx} className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
                              <span className="flex-1 text-sm text-neutral-800 dark:text-neutral-200">{item.label}</span>
                              {canDelete ? (
                                <button onClick={()=>deleteChecklistItem(globalIdx)} className="p-1 rounded text-neutral-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0">
                                  <Trash2 className="w-3.5 h-3.5"/>
                                </button>
                              ) : (
                                <Lock className="w-3 h-3 text-neutral-300 shrink-0 mt-0.5"/>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {isPM && (
                <div className="mt-4">
                  {showAddRow ? (
                    <div className="border border-dashed border-blue-300 dark:border-blue-700 rounded-xl p-4 space-y-3 bg-blue-50/50 dark:bg-blue-900/10">
                      <input value={newSubCategory} onChange={e=>setNewSubCategory(e.target.value)} placeholder="소분류 (선택)"
                        className="text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 w-full bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500"/>
                      <input value={newLabel} onChange={e=>setNewLabel(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addChecklistItem()}
                        placeholder="체크리스트 항목 입력 (Enter로 추가) — 기획 항목으로 추가됨"
                        className="w-full text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500"/>
                      <div className="flex gap-2 justify-end">
                        <button onClick={()=>{setShowAddRow(false);setNewLabel('');setNewSubCategory('');}}
                          className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800">취소</button>
                        <button onClick={addChecklistItem} disabled={!newLabel.trim()}
                          className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">추가</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={()=>setShowAddRow(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600 text-sm text-neutral-500 hover:border-blue-400 hover:text-blue-500 transition-colors">
                      <Plus className="w-4 h-4"/> 기획 체크리스트 추가
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 하단 액션바 */}
      <div className="sticky bottom-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 px-6 py-4 flex justify-between max-w-6xl mx-auto">
        {editId ? <button onClick={onDel} className="text-red-500 hover:text-red-700 text-sm font-medium">삭제</button> : <div/>}
        <div className="flex gap-2">
          <button onClick={()=>router.push('/dev/server')} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg">취소</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving?'저장 중...':editId?'수정':'추가'}</button>
        </div>
      </div>
    </div>
  );
}

/* ============ 공용 폼 필드 (list 페이지와 별개로 이 페이지 전용) ============ */
function Inp({l,v,c,ph,multi,disabled}:{l:string;v:string;c:(v:string)=>void;ph?:string;multi?:boolean;disabled?:boolean}){
  const cls="w-full border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500";
  return(<div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>{multi?<textarea value={v} onChange={e=>c(e.target.value)} placeholder={ph} rows={3} className={cls} disabled={disabled}/>:<input type="text" value={v} onChange={e=>c(e.target.value)} placeholder={ph} className={cls} disabled={disabled}/>}</div>);
}
function Sel({l,v,c,opts}:{l:string;v:string;c:(v:string)=>void;opts:{v:string;l:string}[]}){
  return(<div><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label><select value={v} onChange={e=>c(e.target.value)} className="w-full border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">{opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></div>);
}
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
    </div>);
}
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
    </div>);
}
