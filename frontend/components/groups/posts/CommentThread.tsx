'use client';

import { useEffect, useState } from 'react';

type CommentRow = {
  id: number;
  post_id: number;
  user_id: string;
  nickname: string;
  firstName: string;
  lastName: string;
  avatar: string;
  content: string;
  image: string;
  created_at: string;
};

type ApiList = { ok: boolean; comments: CommentRow[] | null };
type ApiOk = { ok: true };

const cls = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ');
const initials = (name: string) => (name?.trim()?.[0] || '?').toUpperCase();
const avatarUrlFor = (avatar?: string) =>
  avatar ? (avatar.startsWith('/') ? avatar : `/avatars/${avatar}`) : null;

const relTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(1, Math.floor(diff / 1000));
  const m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d > 0) return `${d}d`; if (h > 0) return `${h}h`; if (m > 0) return `${m}m`; return `${s}s`;
};

export default function CommentThread({ postId, onCountChange, }: { postId: number; onCountChange?: (postId: number, newCount: number) => void; }) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState('');

  const load = async () => {
    setErr(null); setLoading(true);
    try {
      const url = `/api/group/post/comments?post_id=${postId}&limit=50&offset=0`;
      const r = await fetch(url, { credentials: 'include' });
      const data: ApiList = await r.json();
      if (!r.ok || !data.ok) throw new Error('Failed to load comments');
      setComments(data.comments || []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [postId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;

    const temp: CommentRow = {
      id: -Date.now(),
      post_id: postId,
      user_id: 'me',
      nickname: '',
      firstName: 'You',
      lastName: '',
      avatar: '',
      content,
      image: '',
      created_at: new Date().toISOString(),
    };
    setComments(prev => [...prev, temp]);
    setText('');
    setPosting(true);
    setErr(null);

    try {
      const body = new URLSearchParams();
      body.set('post_id', String(postId));
      body.set('content', content);

      const r = await fetch('/api/group/post/comments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const data: { ok: boolean; new_count?: number; error?: string } = await r.json().catch(() => ({} as any));
      if (!r.ok || !data.ok) throw new Error(data?.error || 'Failed to add comment')
      if (typeof data.new_count === 'number') {
        onCountChange?.(postId, data.new_count);
      }
      // refresh to get real row (id, timestamps)
      load();
    } catch (e: any) {
      setErr(e?.message || 'Failed to add comment');
      // rollback optimistic temp
      setComments(prev => prev.filter(c => c.id !== temp.id));
      setText(content);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      {err && (
        <div className="mb-2 px-3 py-2 text-sm rounded-md bg-[rgba(255,99,71,.08)] border border-[rgba(255,99,71,.35)] text-[#ffd6d6]">
          {err}
        </div>
      )}

      {/* Composer */}
      <form onSubmit={submit} className="flex items-end gap-2 mb-1">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (text.trim()) {
                // trigger the form submit
                (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
              }
            }
          }}
          placeholder="Write a comment…"
          rows={2}
          className="flex-1 bg-[#232323] text-white border border-[#444] rounded-xl px-3 py-2 resize-none placeholder:text-[#9aa]"
          disabled={posting}
          maxLength={100}
        />
        <button
          type="submit"
          disabled={posting || !text.trim()}
          className={cls(
            "px-4 py-2 rounded-xl text-sm border transition",
            posting
              ? "opacity-60 bg-[#232323] border-white/10"
              : "bg-[#1b1b1b] border-[rgba(0,255,255,.35)] hover:-translate-y-[1px]"
          )}
        >
          {posting ? 'Sending…' : 'Comment'}
        </button>
      </form>

      <div className="text-[11px] text-[#8aa] mb-3">
        Press <b>Enter</b> to send · <b>Shift+Enter</b> for new line
      </div>


      {/* List */}
      {
       comments.length === 0 ? (
        <div className="text-[#9aa] text-sm">No comments yet.</div>
      ) : (
        <ul className="space-y-3">
          {comments.map(c => {
            const name =
              c.nickname?.trim() ||
              `${(c.firstName || '').trim()} ${(c.lastName || '').trim()}`.trim() ||
              c.user_id;
            const a = avatarUrlFor(c.avatar);
            return (
              <li key={c.id} className="flex gap-3 items-start">
                {a ? (
                  <img
                    src={a}
                    alt={`${name} avatar`}
                    className="w-8 h-8 rounded-full object-cover border border-white/10"
                  />
                ) : (
                  <div
                    className="grid place-items-center w-8 h-8 rounded-full text-black text-xs font-semibold"
                    style={{ background: 'radial-gradient(circle at 30% 30%, #00ffcc, #66ffff)' }}
                  >
                    {initials(name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-[#aab] flex items-center gap-2">
                    <span className="text-white font-medium truncate">{name}</span>
                    <span>·</span>
                    <span>{relTime(c.created_at)}</span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {c.content}
                  </div>                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
