'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function BugsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dev/aos'); }, [router]);
  return <div className="p-8 text-gray-400">이동 중...</div>;
}
