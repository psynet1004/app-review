import { cn } from '@/lib/utils';
import type { DevStatus, FixStatus, Priority, SendStatus, ReviewStatus } from '@/lib/types/database';

const devStatusColors: Record<DevStatus, string> = {
  '대기': 'bg-gray-100 text-gray-600',
  '개발중': 'bg-blue-100 text-blue-700',
  '개발완료': 'bg-green-100 text-green-700',
  '검수요청': 'bg-orange-100 text-orange-700',
  '보류': 'bg-red-100 text-red-600',
};
const fixStatusColors: Record<FixStatus, string> = {
  '미수정': 'bg-gray-100 text-gray-600',
  '수정중': 'bg-blue-100 text-blue-700',
  '수정완료': 'bg-green-100 text-green-700',
  '보류': 'bg-red-100 text-red-600',
};
const sendStatusColors: Record<SendStatus, string> = {
  '미전송': 'bg-gray-100 text-gray-500',
  '전송완료': 'bg-emerald-100 text-emerald-700',
  '재전송': 'bg-amber-100 text-amber-700',
};
const reviewStatusColors: Record<ReviewStatus, string> = {
  '검수전': 'bg-gray-100 text-gray-500',
  '검수중': 'bg-yellow-100 text-yellow-700',
  '검수완료': 'bg-teal-100 text-teal-700',
};

export function StatusBadge({ status, type = 'dev' }: { status: string; type?: 'dev' | 'fix' | 'send' | 'review' }) {
  const colors = type === 'dev' ? devStatusColors : type === 'fix' ? fixStatusColors : type === 'review' ? reviewStatusColors : sendStatusColors;
  const color = (colors as Record<string, string>)[status] || 'bg-gray-100 text-gray-600';
  return <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', color)}>{status}</span>;
}

const priorityConfig: Record<Priority, { color: string; dot: string }> = {
  '긴급': { color: 'text-red-600', dot: 'bg-red-500' },
  '높음': { color: 'text-orange-600', dot: 'bg-orange-500' },
  '보통': { color: 'text-yellow-600', dot: 'bg-yellow-500' },
  '낮음': { color: 'text-green-600', dot: 'bg-green-500' },
};

export function PriorityTag({ priority }: { priority: Priority }) {
  const config = priorityConfig[priority] || priorityConfig['보통'];
  return <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', config.color)}><span className={cn('w-2 h-2 rounded-full', config.dot)} />{priority}</span>;
}
