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
    <div className={cn('bg-white dark:bg-slate-900 overflow-hidden', !noBorder && 'rounded-xl border border-gray-200 dark:border-slate-700')}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          {toolbar}
          {selectable && selectedIds && selectedIds.size > 0 && <span className="text-xs text-blue-500 font-medium">{selectedIds.size}개 선택됨</span>}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={searchPlaceholder}
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-52" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
              {selectable && <th className="w-10 px-3 py-2.5 align-middle text-center"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-gray-300" /></th>}
              {columns.map(col => (
                <th key={col.key}
                  className={cn("px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 tracking-wider whitespace-nowrap align-middle", alignCls(col.align), col.sortable && "cursor-pointer select-none", col.width)}
                  onClick={() => col.sortable && handleSort(col.key)}>
                  <div className={cn("inline-flex items-center gap-1", justifyCls(col.align))}>
                    {col.label}
                    {col.sortable && sortKey === col.key && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
            {filtered.length === 0 ? (
              <tr><td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-12 text-center text-gray-400 dark:text-slate-500">{emptyMessage}</td></tr>
            ) : filtered.map(item => (
              <tr key={item[idKey]} className={cn("hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors", selectedIds?.has(item[idKey]) && "bg-blue-50 dark:bg-blue-900/20")}>
                {selectable && <td className="w-10 px-3 py-2.5 align-middle text-center"><input type="checkbox" checked={selectedIds?.has(item[idKey]) ?? false} onChange={() => toggleOne(item[idKey])} className="rounded border-gray-300" /></td>}
                {columns.map(col => (
                  <td key={col.key} className={cn("px-4 py-2.5 text-gray-700 dark:text-slate-300 align-middle", alignCls(col.align), col.width)}>
                    {col.render ? col.render(item) : String(item[col.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-700 text-xs text-gray-400 dark:text-slate-500">
        총 {filtered.length}건{data.length !== filtered.length && ` (전체 ${data.length}건)`}
      </div>
    </div>
  );
}
