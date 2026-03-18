"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { QA_CATEGORIES } from "@/lib/types/database";
import type { QAResult } from "@/lib/types/database";

const QA_OPTIONS: { v: QAResult | ""; l: string; color: string }[] = [
  { v: "", l: "-", color: "bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500" },
  { v: "검수중", l: "검수중", color: "bg-green-600 text-white" },
  { v: "검수완료", l: "검수완료", color: "bg-amber-700 text-white" },
  { v: "재수정", l: "재수정", color: "bg-red-700 text-white" },
  { v: "출시검수", l: "출시검수", color: "bg-purple-600 text-white" },
  { v: "미해당", l: "미해당", color: "bg-neutral-500 text-white" },
];

interface QAResultBadgeProps {
  item: any;
  table: string;
  onUpdated: () => void;
}

export function QAResultBadge({ item, table, onUpdated }: QAResultBadgeProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qa: Record<string, string> = item.qa_results || {};

  const allDone = QA_CATEGORIES.every(
    (cat) => qa[cat] === "검수완료" || qa[cat] === "미해당"
  );
  const hasAny = QA_CATEGORIES.some((cat) => qa[cat] && qa[cat] !== "");
  const doneCount = QA_CATEGORIES.filter(
    (cat) => qa[cat] === "검수완료" || qa[cat] === "미해당"
  ).length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = async (cat: string, val: string) => {
    const supabase = createClient();
    const newQa = { ...qa, [cat]: val };
    await supabase.from(table).update({ qa_results: newQa }).eq("id", item.id);
    onUpdated();
  };

  const needsAttention = !allDone && (item.review_status === '검수완료');
  const badgeColor = allDone
    ? "bg-green-100 text-green-700 border-green-400 dark:bg-green-900/30 dark:text-green-400 dark:border-green-600"
    : hasAny
    ? "bg-amber-100 text-amber-700 border-amber-400 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-600"
    : "bg-neutral-100 text-neutral-500 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-500 dark:border-neutral-600";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border-2 whitespace-nowrap ${badgeColor} ${needsAttention ? "animate-pulse ring-2 ring-red-400 ring-offset-1" : ""}`}
      >
        {allDone ? "✓ 완료" : hasAny ? `${doneCount}/${QA_CATEGORIES.length}` : "검수결과"}
      </button>
      {open && (
        <>
        <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setOpen(false)}/>
        <div
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-600 rounded-lg shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:shadow-[6px_6px_0_0_rgba(255,255,255,0.05)] p-4 w-fit"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2"><span className="text-xs font-black text-neutral-600 dark:text-neutral-400">검수결과</span><button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-sm font-bold">✕</button></div>
          <div className="flex gap-3">
            {QA_CATEGORIES.map((cat) => (
              <div key={cat} className="flex flex-col items-center gap-1 min-w-[64px]">
                <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                  {cat}
                </span>
                <div className="flex flex-col gap-0.5">
                  {QA_OPTIONS.map((opt) => (
                    <button
                      key={opt.v}
                      onClick={() => handleChange(cat, opt.v)}
                      className={`text-[10px] font-bold px-2 py-1 rounded border transition-all w-full text-center whitespace-nowrap ${
                        qa[cat] === opt.v || (!qa[cat] && opt.v === "")
                          ? `${opt.color} border-transparent ring-2 ring-black dark:ring-white ring-offset-1`
                          : "bg-neutral-50 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        </>
      )}
    </div>
  );
}

export function isQAComplete(item: any): boolean {
  const qa: Record<string, string> = item.qa_results || {};
  return QA_CATEGORIES.every(
    (cat) => qa[cat] === "검수완료" || qa[cat] === "미해당"
  );
}
