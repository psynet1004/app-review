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
      result = result.filter(item =>
        searchKeys.some(key => String(item[key] || '').toLowerCase().includes(q))
      );
    }
    if (sortKey) {
      result.sort((a, b) => {
        const aVal = a[sortKey] ?? '';
        const bVal = b[sortKey] ?? '';
        const cmp = String(aVal).localeCompare(String(bVal), 'ko');
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [data, search, searchKeys, sortKey, sortDir]);

  const allSelected = filtered.length > 0 && selectedIds && filtered.every(item => selectedIds.has(item[idKey]));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(filtered.map(item => item[idKey])));
    }
  };

  const toggleOne = (id: string) => {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectionChange(next);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className={cn(
      'bg-white overflow-hidden',
      !noBorder && 'rounded-xl border border-gray-200'
    )}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {toolbar}
          {selectable && selectedIds && selectedIds.size > 0 && (
            <span className="text-xs text-blue-600 font-medium">{selectedIds.size}개 선택됨</span>
          )}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-52"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {selectable && (
                <th className="w-10 px-3 py-2.5">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                </th>
              )}
              {columns.map(col => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap",
                    col.sortable && "cursor-pointer hover:text-gray-700 select-none",
                    col.width
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-12 text-center text-gray-400">{emptyMessage}</td></tr>
            ) : (
              filtered.map(item => (
                <tr key={item[idKey]} className={cn(
                  "hover:bg-blue-50/50 transition-colors",
                  selectedIds?.has(item[idKey]) && "bg-blue-50"
                )}>
                  {selectable && (
                    <td className="w-10 px-3 py-2">
                      <input type="checkbox" checked={selectedIds?.has(item[idKey]) ?? false}
                        onChange={() => toggleOne(item[idKey])}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    </td>
                  )}
                  {columns.map(col => (
                    <td key={col.key} className={cn("px-3 py-2 text-gray-700", col.width)}>
                      {col.render ? col.render(item) : String(item[col.key] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
        총 {filtered.length}건{data.length !== filtered.length && ` (전체 ${data.length}건)`}
      </div>
    </div>
  );
}
