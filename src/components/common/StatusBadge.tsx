import { cn } from '@/lib/utils';
import type { DevStatus, FixStatus, Priority, SendStatus, ReviewStatus } from '@/lib/types/database';

/* Monochrome palette: black/gray/white + red accent for completion/important */
const devStatusColors: Record<DevStatus, string> = {
  '대기': 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500',
  '개발중': 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300',
  '개발완료': 'bg-neutral-900 text-white dark:bg-white dark:text-black',
  '검수요청': 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  '보류': 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500 line-through',
};
const fixStatusColors: Record<FixStatus, string> = {
  '미수정': 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500',
  '수정중': 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300',
  '수정완료': 'bg-red-600 text-white dark:bg-red-600 dark:text-white',
  '보류': 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500 line-through',
};
const sendStatusColors: Record<SendStatus, string> = {
  '미전송': 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500',
  '전송완료': 'bg-neutral-900 text-white dark:bg-white dark:text-black',
  '재전송': 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300',
};
const reviewStatusColors: Record<ReviewStatus, string> = {
  '검수전': 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500',
  '검수중': 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300',
  '검수완료': 'bg-red-600 text-white dark:bg-red-600 dark:text-white',
};

export function StatusBadge({ status, type = 'dev' }: { status: string; type?: 'dev' | 'fix' | 'send' | 'review' }) {
  const colors = type === 'dev' ? devStatusColors : type === 'fix' ? fixStatusColors : type === 'review' ? reviewStatusColors : sendStatusColors;
  const color = (colors as Record<string, string>)[status] || 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500';
  return <span className={cn('inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', color)}>{status}</span>;
}

const priorityConfig: Record<Priority, { color: string; dot: string }> = {
  '긴급': { color: 'text-red-600 dark:text-red-400 font-bold', dot: 'bg-red-500' },
  '높음': { color: 'text-neutral-800 dark:text-neutral-200 font-semibold', dot: 'bg-neutral-700 dark:bg-neutral-300' },
  '보통': { color: 'text-neutral-500 dark:text-neutral-400', dot: 'bg-neutral-400' },
  '낮음': { color: 'text-neutral-400 dark:text-neutral-500', dot: 'bg-neutral-300 dark:bg-neutral-600' },
};

export function PriorityTag({ priority }: { priority: Priority }) {
  const config = priorityConfig[priority] || priorityConfig['보통'];
  return <span className={cn('inline-flex items-center gap-1.5 text-xs', config.color)}><span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />{priority}</span>;
}
