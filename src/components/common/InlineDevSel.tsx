"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface InlineDevSelProps {
  item: any;
  table: string;
  developers: any[];
  onUpdated: () => void;
}

export function InlineDevSel({ item, table, developers, onUpdated }: InlineDevSelProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const val = item.developer_ids || item.developer_id || "";
  const selectedIds = val ? String(val).split(",").filter(Boolean) : [];
  const names = selectedIds.map((id: string) => developers.find((d: any) => d.id === id)?.name).filter(Boolean);

  const toggle = (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter((x: string) => x !== id) : [...selectedIds, id];
    supabase.from(table).update({ developer_ids: next.join(",") || null, developer_id: null }).eq("id", item.id).then(() => onUpdated());
  };
  const toggleGroup = (ids: string[]) => {
    const allSel = ids.every((id) => selectedIds.includes(id));
    const next = allSel ? selectedIds.filter((x: string) => !ids.includes(x)) : Array.from(new Set([...selectedIds, ...ids]));
    supabase.from(table).update({ developer_ids: next.join(",") || null, developer_id: null }).eq("id", item.id).then(() => onUpdated());
  };
  const clear = () => {
    supabase.from(table).update({ developer_ids: null, developer_id: null }).eq("id", item.id).then(() => onUpdated());
    setOpen(false);
  };

  const groups = [
    { label: "AOS팀", items: developers.filter((d: any) => d.department === "개발팀" && d.platform === "AOS") },
    { label: "iOS팀", items: developers.filter((d: any) => d.department === "개발팀" && d.platform === "iOS") },
    { label: "서버팀", items: developers.filter((d: any) => d.department === "서버(백앤드)" || d.department === "서버(시스템)") },
  ].filter((g) => g.items.length > 0);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:underline">
        {names.length ? names.join(", ") : <span className="text-neutral-300 dark:text-neutral-600">미배정</span>}
      </button>
      {open && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-600 rounded-lg shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:shadow-[3px_3px_0_0_rgba(255,255,255,0.05)] overflow-y-auto min-w-[180px]" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={clear} className={`w-full text-left px-3 py-2 text-xs font-medium border-b border-neutral-200 dark:border-neutral-700 ${selectedIds.length === 0 ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-neutral-50 dark:hover:bg-neutral-800"}`}>미배정</button>
          {groups.map((g) => {
            const gIds = g.items.map((d: any) => d.id);
            const allSel = gIds.every((id: string) => selectedIds.includes(id));
            return (
              <div key={g.label}>
                <button type="button" onClick={() => toggleGroup(gIds)} className={`w-full text-left px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between ${allSel ? "bg-neutral-900 text-white dark:bg-white dark:text-black" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"}`}>
                  <span>{g.label} 전체</span><span className="text-[10px]">{allSel ? "✓" : g.items.length + "명"}</span>
                </button>
                {g.items.map((d: any) => (
                  <button type="button" key={d.id} onClick={() => toggle(d.id)} className={`w-full text-left px-3 pl-5 py-1.5 text-xs font-medium border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-2 ${selectedIds.includes(d.id) ? "bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white" : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300"}`}>
                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] ${selectedIds.includes(d.id) ? "bg-black dark:bg-white border-black dark:border-white text-white dark:text-black" : "border-neutral-300 dark:border-neutral-600"}`}>{selectedIds.includes(d.id) ? "✓" : ""}</span>
                    {d.name}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
