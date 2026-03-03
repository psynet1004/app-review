import { cn } from '@/lib/utils';
import type { DevStatus, FixStatus, Priority, SendStatus, ReviewStatus } from '@/lib/types/database';

/* Cel-shaded: bold borders, flat fills, black/white/red only */
const devStatusColors: Record<DevStatus, string> = {
  '대기': 'bg-neutral-100 text-neutral-500 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-500 dark:border-neutral-600',
  '개발중': 'bg-white text-black border-black dark:bg-neutral-800 dark:text-white dark:border-neutral-500',
  '개발완료': 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white',
  '배포완료': 'bg-purple-50 text-purple-600 border-purple-500 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-500',
  '보류': 'bg-neutral-100 text-neutral-400 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-600 dark:border-neutral-700 line-through',
};
const fixStatusColors: Record<FixStatus, string> = {
  '미수정': 'bg-neutral-100 text-neutral-500 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-500 dark:border-neutral-600',
  '수정중': 'bg-white text-black border-black dark:bg-neutral-800 dark:text-white dark:border-neutral-500',
  '수정완료': 'bg-red-600 text-white border-red-700 dark:bg-red-600 dark:text-white dark:border-red-500',
  '보류': 'bg-neutral-100 text-neutral-400 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-600 dark:border-neutral-700 line-through',
};
const sendStatusColors: Record<SendStatus, string> = {
  '미전송': 'bg-neutral-100 text-neutral-400 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-500 dark:border-neutral-600',
  '전송완료': 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white',
  '재전송': 'bg-white text-neutral-700 border-neutral-400 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-600',
};
const reviewStatusColors: Record<ReviewStatus, string> = {
  '검수전': 'bg-neutral-100 text-neutral-400 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-500 dark:border-neutral-600',
  '검수중': 'bg-white text-black border-black dark:bg-neutral-800 dark:text-white dark:border-neutral-500',
  '검수완료': 'bg-red-600 text-white border-red-700 dark:bg-red-600 dark:text-white dark:border-red-500',
};

export function StatusBadge({ status, type = 'dev' }: { status: string; type?: 'dev' | 'fix' | 'send' | 'review' }) {
  const colors = type === 'dev' ? devStatusColors : type === 'fix' ? fixStatusColors : type === 'review' ? reviewStatusColors : sendStatusColors;
  const color = (colors as Record<string, string>)[status] || 'bg-neutral-100 text-neutral-400 border-neutral-300';
  return <span className={cn('inline-flex px-2.5 py-0.5 rounded-md text-xs font-bold whitespace-nowrap border-2', color)}>{status}</span>;
}

const priorityConfig: Record<Priority, { color: string; dot: string; bg: string }> = {
  '긴급': { color: 'text-red-700 dark:text-red-400 font-black', dot: 'bg-red-500 border border-red-700 animate-pulse', bg: 'bg-red-50 border border-red-200 dark:bg-red-900/30 dark:border-red-800' },
  '높음': { color: 'text-orange-700 dark:text-orange-300 font-bold', dot: 'bg-orange-500 dark:bg-orange-400', bg: 'bg-orange-50 border border-orange-200 dark:bg-orange-900/30 dark:border-orange-800' },
  '보통': { color: 'text-neutral-600 dark:text-neutral-400 font-medium', dot: 'bg-neutral-400', bg: 'bg-neutral-50 border border-neutral-200 dark:bg-neutral-800/50 dark:border-neutral-700' },
  '낮음': { color: 'text-neutral-400 dark:text-neutral-500', dot: 'bg-neutral-300 dark:bg-neutral-600', bg: 'bg-neutral-50/50 border border-neutral-100 dark:bg-neutral-800/30 dark:border-neutral-700' },
};

export function PriorityTag({ priority }: { priority: Priority }) {
  const config = priorityConfig[priority] || priorityConfig['보통'];
  return <span className={cn('inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-md', config.color, config.bg)}><span className={cn('w-2 h-2 rounded-full', config.dot)} />{priority}</span>;
}
