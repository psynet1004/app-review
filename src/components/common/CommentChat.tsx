'use client';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, Send, MessageCircle, Paperclip, Loader2 } from 'lucide-react';
import { useVersion } from '@/components/layout/Header';

interface Comment {
  id: string;
  item_id: string;
  item_type: string;
  user_name: string;
  user_email: string;
  message: string;
  image_url: string | null;
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('item_id', itemId)
      .eq('item_type', itemType)
      .order('created_at', { ascending: true });
    setComments(data || []);
    if (userEmail) {
      await supabase.from('comment_reads').upsert(
        { item_id: itemId, item_type: itemType, user_email: userEmail, last_read_at: new Date().toISOString() },
        { onConflict: 'item_id,item_type,user_email' }
      );
    }
  };

  useEffect(() => { loadComments(); }, [itemId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [comments]);

  // 이미지 파일 처리
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('이미지 크기는 5MB 이하만 가능합니다.');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  // 클립보드 붙여넣기
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) handleImageFile(file);
        return;
      }
    }
  };

  // 파일 선택
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
    e.target.value = '';
  };

  // 이미지 업로드
  const uploadImage = async (file: File): Promise<string | null> => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `${itemType}/${itemId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from('comment-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (error) {
        console.error('Upload error:', error);
        alert('이미지 업로드에 실패했습니다.');
        return null;
      }
      const { data: urlData } = supabase.storage
        .from('comment-images')
        .getPublicUrl(fileName);
      return urlData.publicUrl;
    } catch (err) {
      console.error('Upload error:', err);
      alert('이미지 업로드에 실패했습니다.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  // 이미지 미리보기 제거
  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSend = async () => {
    if ((!message.trim() && !imageFile) || sending) return;
    setSending(true);

    let image_url: string | null = null;
    if (imageFile) {
      image_url = await uploadImage(imageFile);
      if (!image_url && !message.trim()) {
        setSending(false);
        return;
      }
    }

    await supabase.from('comments').insert({
      item_id: itemId,
      item_type: itemType,
      user_name: userName || userEmail || 'Unknown',
      user_email: userEmail || '',
      message: message.trim(),
      image_url,
    });
    setMessage('');
    clearImage();
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
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white dark:bg-neutral-900 rounded-lg border-2 border-black dark:border-neutral-600 shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:shadow-[6px_6px_0_0_rgba(255,255,255,0.05)] w-full max-w-md h-[560px] flex flex-col" onClick={e => e.stopPropagation()}>
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
                    {c.image_url && (
                      <img
                        src={c.image_url}
                        alt="첨부 이미지"
                        className="max-w-full max-h-48 rounded-md mb-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); setViewImage(c.image_url); }}
                      />
                    )}
                    {c.message && <span className="whitespace-pre-wrap break-words">{c.message}</span>}
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-0.5 px-1">{formatTime(c.created_at)}</span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Image Preview */}
          {imagePreview && (
            <div className="px-3 py-2 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
              <div className="relative inline-block">
                <img src={imagePreview} alt="미리보기" className="h-20 rounded-md border border-neutral-300 dark:border-neutral-600" />
                <button
                  onClick={clearImage}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 border border-white dark:border-neutral-900"
                >
                  <X size={10} strokeWidth={3} />
                </button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-3 py-3 border-t-2 border-black dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 rounded-b-lg">
            <div className="flex items-center gap-2">
              {/* 파일 첨부 버튼 */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md transition-colors"
                title="이미지 첨부"
              >
                <Paperclip size={16} strokeWidth={2} />
              </button>

              <input
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                onPaste={handlePaste}
                placeholder={imageFile ? "설명 추가 또는 바로 전송..." : "코멘트 입력... (Ctrl+V 이미지 붙여넣기)"}
                className="flex-1 text-sm border-2 border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-black dark:text-white rounded-md px-3 py-2 focus:border-black dark:focus:border-white focus:outline-none placeholder-neutral-400"
              />
              <button
                onClick={handleSend}
                disabled={(!message.trim() && !imageFile) || sending || uploading}
                className="p-2 bg-black dark:bg-white text-white dark:text-black rounded-md border-2 border-black dark:border-white hover:shadow-[2px_2px_0_0_rgba(0,0,0,0.5)] disabled:opacity-30 transition-all"
              >
                {(sending || uploading) ? <Loader2 size={16} strokeWidth={2.5} className="animate-spin" /> : <Send size={16} strokeWidth={2.5} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 이미지 확대 보기 모달 */}
      {viewImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={() => setViewImage(null)}>
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img src={viewImage} alt="확대 보기" className="max-w-full max-h-[85vh] rounded-lg object-contain" />
            <button
              onClick={() => setViewImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white text-black rounded-full flex items-center justify-center border-2 border-black hover:bg-neutral-100 shadow-lg"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}
    </>
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
