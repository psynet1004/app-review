'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';

interface Column<T> {
  key: string;
  label: string;
  width?: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  idKey?: string;
  searchPlaceholder?: string;
  searchKeys?: string[];
  toolbar?: React.ReactNode;
  emptyMessage?: string;
  noBorder?: boolean;
}

export default function DataTable<T extends Record<string, any>>({
  data, columns, selectable = false, selectedIds, onSelectionChange,
  idKey = 'id', searchPlaceholder = '검색...', searchKeys = [], toolbar,
  emptyMessage = '데이터가 없습니다', noBorder = false,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let result = [...data];
    if (search && searchKeys.length > 0) {
      const q = search.toLowerCase();
      result = result.filter(item => searchKeys.some(key => String(item[key] || '').toLowerCase().includes(q)));
    }
    if (sortKey) {
      result.sort((a, b) => {
        const cmp = String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), 'ko');
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [data, search, searchKeys, sortKey, sortDir]);

  const allSelected = filtered.length > 0 && selectedIds && filtered.every(item => selectedIds.has(item[idKey]));
  const toggleAll = () => { if (!onSelectionChange) return; onSelectionChange(allSelected ? new Set() : new Set(filtered.map(item => item[idKey]))); };
  const toggleOne = (id: string) => { if (!onSelectionChange || !selectedIds) return; const n = new Set(selectedIds); n.has(id) ? n.delete(id) : n.add(id); onSelectionChange(n); };
  const handleSort = (key: string) => { if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDir('asc'); } };

  const alignCls = (a?: string) => a === 'center' ? 'text-center' : a === 'right' ? 'text-right' : 'text-left';
  const justifyCls = (a?: string) => a === 'center' ? 'justify-center' : a === 'right' ? 'justify-end' : '';

  return (
    <div className={cn('bg-white dark:bg-neutral-900 overflow-hidden', !noBorder && 'rounded-lg border-2 border-black dark:border-neutral-700 shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:shadow-[3px_3px_0_0_rgba(255,255,255,0.05)]')}>
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-2">
          {toolbar}
          {selectable && selectedIds && selectedIds.size > 0 && <span className="text-xs text-neutral-600 font-bold bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-600">{selectedIds.size}개 선택</span>}
        </div>
        <div className="relative">
          <Search size={14} strokeWidth={2.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={searchPlaceholder}
            className="pl-8 pr-3 py-1.5 text-sm border-2 border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-black dark:text-white rounded-md font-medium focus:border-black dark:focus:border-white focus:outline-none w-52" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-100 dark:bg-neutral-800 border-b-2 border-black dark:border-neutral-700">
              {selectable && <th className="w-10 px-3 py-2.5 align-middle text-center"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-2 border-black accent-black" /></th>}
              {columns.map(col => (
                <th key={col.key}
                  className={cn("px-4 py-2.5 text-xs font-black text-neutral-600 dark:text-neutral-400 tracking-wider whitespace-nowrap align-middle uppercase", alignCls(col.align), col.sortable && "cursor-pointer select-none hover:text-black dark:hover:text-white", col.width)}
                  onClick={() => col.sortable && handleSort(col.key)}>
                  <div className={cn("inline-flex items-center gap-1", justifyCls(col.align))}>
                    {col.label}
                    {col.sortable && sortKey === col.key && (sortDir === 'asc' ? <ChevronUp size={12} strokeWidth={3} /> : <ChevronDown size={12} strokeWidth={3} />)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {filtered.length === 0 ? (
              <tr><td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-12 text-center text-neutral-400 font-medium">{emptyMessage}</td></tr>
            ) : filtered.map(item => (
              <tr key={item[idKey]} className={cn("hover:bg-stone-50 dark:hover:bg-neutral-800/50 transition-colors", selectedIds?.has(item[idKey]) && "bg-yellow-50 dark:bg-yellow-900/10")}>
                {selectable && <td className="w-10 px-3 py-2.5 align-middle text-center"><input type="checkbox" checked={selectedIds?.has(item[idKey]) ?? false} onChange={() => toggleOne(item[idKey])} className="rounded border-2 border-black accent-black" /></td>}
                {columns.map(col => (
                  <td key={col.key} className={cn("px-4 py-2.5 text-neutral-800 dark:text-neutral-200 align-middle font-medium", alignCls(col.align), col.width)}>
                    {col.render ? col.render(item) : String(item[col.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t-2 border-neutral-200 dark:border-neutral-700 text-xs text-neutral-500 font-bold">
        총 {filtered.length}건{data.length !== filtered.length && ` (전체 ${data.length}건)`}
      </div>
    </div>
  );
}
