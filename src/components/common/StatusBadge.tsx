import { cn } from '@/lib/utils';
import type { DevStatus, FixStatus, Priority, SendStatus, ReviewStatus } from '@/lib/types/database';

const devStatusColors: Record<DevStatus, string> = {
  '대기': 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  '개발중': 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  '개발완료': 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  '검수요청': 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  '보류': 'bg-rose-50 text-rose-500 dark:bg-rose-900/30 dark:text-rose-400',
};
const fixStatusColors: Record<FixStatus, string> = {
  '미수정': 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  '수정중': 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  '수정완료': 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  '보류': 'bg-rose-50 text-rose-500 dark:bg-rose-900/30 dark:text-rose-400',
};
const sendStatusColors: Record<SendStatus, string> = {
  '미전송': 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500',
  '전송완료': 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  '재전송': 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
};
const reviewStatusColors: Record<ReviewStatus, string> = {
  '검수전': 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500',
  '검수중': 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  '검수완료': 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
};

export function StatusBadge({ status, type = 'dev' }: { status: string; type?: 'dev' | 'fix' | 'send' | 'review' }) {
  const colors = type === 'dev' ? devStatusColors : type === 'fix' ? fixStatusColors : type === 'review' ? reviewStatusColors : sendStatusColors;
  const color = (colors as Record<string, string>)[status] || 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
  return <span className={cn('inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', color)}>{status}</span>;
}

const priorityConfig: Record<Priority, { color: string; dot: string }> = {
  '긴급': { color: 'text-rose-500 dark:text-rose-400', dot: 'bg-rose-400' },
  '높음': { color: 'text-amber-500 dark:text-amber-400', dot: 'bg-amber-400' },
  '보통': { color: 'text-gray-500 dark:text-slate-400', dot: 'bg-gray-400' },
  '낮음': { color: 'text-sky-500 dark:text-sky-400', dot: 'bg-sky-400' },
};

export function PriorityTag({ priority }: { priority: Priority }) {
  const config = priorityConfig[priority] || priorityConfig['보통'];
  return <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', config.color)}><span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />{priority}</span>;
}
