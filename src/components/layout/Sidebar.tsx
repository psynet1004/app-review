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
        'bg-neutral-950 text-white flex flex-col transition-[width] duration-200 border-r-[3px] border-black',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      <div className="h-14 flex items-center px-4 border-b-2 border-neutral-800 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white text-black rounded-md border-2 border-black flex items-center justify-center text-xs font-black shadow-[2px_2px_0_0_rgba(255,255,255,0.2)]">
              QA
            </div>
            <span className="font-bold text-sm whitespace-nowrap tracking-tight">검수 관리</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'p-1 rounded-md hover:bg-neutral-800 text-neutral-500 border border-neutral-700',
            collapsed ? 'mx-auto' : 'ml-auto'
          )}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map((item, i) => {
          if ('type' in item && item.type === 'divider') {
            return !collapsed ? (
              <div key={`div-${i}`} className="px-4 pt-5 pb-1">
                <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                  {item.label}
                </span>
              </div>
            ) : (
              <div key={`div-${i}`} className="my-2 mx-3 border-t-2 border-neutral-800" />
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
                'flex items-center gap-3 mx-2 px-3 py-2 rounded-md text-sm font-medium transition-all',
                active
                  ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,0.8)]'
                  : 'text-neutral-400 hover:bg-neutral-900 hover:text-white border-2 border-transparent',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? nav.label : undefined}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 2} />
              {!collapsed && <span>{nav.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
