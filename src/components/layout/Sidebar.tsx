'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Smartphone, Apple, Bug,
  AlertTriangle, Server, ScrollText, Settings,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { label: '대시보드', href: '/', icon: LayoutDashboard },
  { type: 'divider' as const, label: '개발항목' },
  { label: 'AOS', href: '/dev/aos', icon: Smartphone },
  { label: 'iOS', href: '/dev/ios', icon: Apple },
  { type: 'divider' as const, label: '오류관리' },
  { label: '앱 오류', href: '/bugs', icon: Bug },
  { label: '공통 오류', href: '/bugs/common', icon: AlertTriangle },
  { label: '서버 오류', href: '/bugs/server', icon: Server },
  { type: 'divider' as const, label: '관리' },
  { label: '전송 이력', href: '/logs', icon: ScrollText },
  { label: '설정', href: '/settings', icon: Settings },
];

function isActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  // /bugs 는 정확 매치만, /bugs/common, /bugs/server는 별도
  if (href === '/bugs') return pathname === '/bugs';
  return pathname.startsWith(href);
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      id="dashboard-sidebar"
      className={cn(
        'bg-slate-900 text-white flex flex-col transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-slate-700 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center text-xs font-bold">
              QA
            </div>
            <span className="font-semibold text-sm whitespace-nowrap">앱 검수 관리</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'p-1 rounded hover:bg-slate-700 text-slate-400',
            collapsed ? 'mx-auto' : 'ml-auto'
          )}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map((item, i) => {
          if ('type' in item && item.type === 'divider') {
            return !collapsed ? (
              <div key={`div-${i}`} className="px-4 pt-4 pb-1">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  {item.label}
                </span>
              </div>
            ) : (
              <div key={`div-${i}`} className="my-2 mx-3 border-t border-slate-700" />
            );
          }

          const nav = item as { label: string; href: string; icon: any };
          const Icon = nav.icon;
          const active = isActive(nav.href, pathname);

          return (
            <Link
              key={nav.href}
              href={nav.href}
              prefetch={true}
              className={cn(
                'flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? nav.label : undefined}
            >
              <Icon size={18} />
              {!collapsed && <span>{nav.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
