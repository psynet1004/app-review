'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { LogOut, User } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export default function Header() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
          AOS V51.0.3
        </span>
        <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
          iOS V40.2
        </span>
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center">
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="" className="w-7 h-7 rounded-full" />
              ) : (
                <User size={14} />
              )}
            </div>
            <span className="hidden sm:inline">{user.user_metadata?.full_name || user.email}</span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="로그아웃"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
