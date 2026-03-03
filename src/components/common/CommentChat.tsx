'use client';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, Send, MessageCircle } from 'lucide-react';
import { useVersion } from '@/components/layout/Header';

interface Comment {
  id: string;
  item_id: string;
  item_type: string;
  user_name: string;
  user_email: string;
  message: string;
  created_at: string;
}

interface CommentChatProps {
  itemId: string;
  itemType: 'dev_items' | 'bug_items' | 'common_bugs' | 'server_bugs';
  itemTitle: string;
  onClose: () => void;
  onCommentAdded?: () => void;
}

export function CommentChat({ itemId, itemType, itemTitle, onClose, onCommentAdded }: CommentChatProps) {
  const supabase = createClient();
  const { userName, userEmail } = useVersion();
  const [comments, setComments] = useState<Comment[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('item_id', itemId)
      .eq('item_type', itemType)
      .order('created_at', { ascending: true });
    setComments(data || []);
    // 읽음 처리
    if (userEmail) {
      await supabase.from('comment_reads').upsert(
        { item_id: itemId, item_type: itemType, user_email: userEmail, last_read_at: new Date().toISOString() },
        { onConflict: 'item_id,item_type,user_email' }
      );
    }
  };

  useEffect(() => { loadComments(); }, [itemId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [comments]);

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    await supabase.from('comments').insert({
      item_id: itemId,
      item_type: itemType,
      user_name: userName || userEmail || 'Unknown',
      user_email: userEmail || '',
      message: message.trim(),
    });
    setMessage('');
    setSending(false);
    await loadComments();
    onCommentAdded?.();
  };

  const formatTime = (dt: string) => {
    const d = new Date(dt);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return '방금';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-neutral-900 rounded-lg border-2 border-black dark:border-neutral-600 shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:shadow-[6px_6px_0_0_rgba(255,255,255,0.05)] w-full max-w-md h-[500px] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 rounded-t-lg">
          <div className="flex items-center gap-2">
            <MessageCircle size={16} strokeWidth={2.5} />
            <span className="font-bold text-sm truncate max-w-[280px]">{itemTitle}</span>
            <span className="text-xs text-neutral-500 bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.5 rounded-full">{comments.length}</span>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-white"><X size={18} /></button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {comments.length === 0 && (
            <div className="flex items-center justify-center h-full text-neutral-400 text-sm">첫 코멘트를 남겨보세요</div>
          )}
          {comments.map(c => {
            const isMe = c.user_email === userEmail;
            return (
              <div key={c.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-neutral-400 mb-0.5 px-1">{c.user_name}</span>
                <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${isMe
                  ? 'bg-black text-white dark:bg-white dark:text-black rounded-tr-none'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 rounded-tl-none'
                }`}>
                  {c.message}
                </div>
                <span className="text-[10px] text-neutral-400 mt-0.5 px-1">{formatTime(c.created_at)}</span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-3 py-3 border-t-2 border-black dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 rounded-b-lg">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="코멘트 입력..."
              className="flex-1 text-sm border-2 border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 rounded-md px-3 py-2 focus:border-black dark:focus:border-white focus:outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className="p-2 bg-black dark:bg-white text-white dark:text-black rounded-md border-2 border-black dark:border-white hover:shadow-[2px_2px_0_0_rgba(0,0,0,0.5)] disabled:opacity-30 transition-all"
            >
              <Send size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* 코멘트 카운트 + 뱃지 표시용 아이콘 */
export function CommentBadge({ itemId, itemType, count, hasNew, onClick }: {
  itemId: string; itemType: string; count: number; hasNew: boolean; onClick: () => void;
}) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick(); }} className="relative inline-flex items-center gap-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors">
      <MessageCircle size={15} strokeWidth={2} />
      {count > 0 && <span className="text-[10px] font-bold">{count}</span>}
      {hasNew && (
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white dark:border-neutral-900 animate-pulse" />
      )}
    </button>
  );
}
