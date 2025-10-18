'use client';
import CommentThread from '@/components/groups/posts/CommentThread';
import { useEffect, useMemo, useState } from 'react';
import ProfileCard from '@/components/profile/ProfileCard';
import { User } from "@/types/user";

const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_ORIGIN || 'http://localhost:8080';

type PostRow = {
  post_id: number;
  group_id: number;
  user_id: string;
  nickname: string;
  firstName: string;
  lastName: string;
  avatar: string;
  image: string;
  content: string;
  comment_count: number;
  created_at: string; 
};
interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  email: string;
  dob: string;
  aboutMe: string;
  avatar: string;
  online?: boolean
  isPublic?: boolean
}

type ApiResp =
  | { ok?: boolean; posts?: PostRow[]; data?: { posts?: PostRow[] } }
  | PostRow[]; 

type Props = {
  groupId: number;
  pageSize?: number;
  refreshKey?: number;
};


const cls = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ');

const initials = (firstName: string) => (firstName?.trim()?.[0] || '?').toUpperCase();
const avatarUrlFor = (avatar?: string) =>
  avatar ? (avatar.startsWith('/') ? avatar : `/avatars/${avatar}`) : null;
const imageUrlFor = (filename?: string) =>
  filename
    ? `${API_ORIGIN}/uploads/${encodeURIComponent(filename)}`
    : null;

const relTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(1, Math.floor(diff / 1000));
  const m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
};

export default function PostsList({ groupId, pageSize = 10, refreshKey = 0 }: Props) {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
    const [ViewingProfile, setViewingProfile] = useState<UserProfile | null>(null);
    const [message, setMessage] = useState("");
const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
const toggleComments = (postId: number) =>
  setOpenComments(prev => ({ ...prev, [postId]: !prev[postId] }));

  // Reset when group changes or refreshKey bumps
  useEffect(() => {
    setPosts([]);
    setOffset(0);
    setHasMore(true);
    setError(null);
  }, [groupId, refreshKey]);

 const fetchPage = async (kind: 'first' | 'more') => {
  if (loading || loadingMore) return;
  kind === 'first' ? setLoading(true) : setLoadingMore(true);
  setError(null);

  try {
    const params = new URLSearchParams({
      group_id: String(groupId),
      limit: String(pageSize),
      offset: String(kind === 'first' ? 0 : offset),
    });

    const res = await fetch(`/api/group/posts?${params.toString()}`, {
      credentials: 'include',
    });

    // Read text first so we can handle empty/no-JSON bodies gracefully
    const raw = await res.text();
    let json: ApiResp = {};
    if (raw) {
      try {
        json = JSON.parse(raw);
      } catch (e) {
        // Non-JSON response but 2xx: treat as no posts instead of hard-failing
        console.debug('Non-JSON posts response:', raw);
        json = {};
      }
    }

 if (!res.ok) {
  if (res.status === 204 || res.status === 404) {
    if (kind === 'first') {
      setPosts([]);
      setOffset(0);
    }
    setHasMore(false);
    // no error banner; just render the "No posts yet." state
    return;
  }

  // Auth/permission errors: show a clear message
  if (res.status === 401 || res.status === 403) {
    setError('You do not have permission to view these posts. Please sign in.');
    setHasMore(false);
    return;
  }

  // Everything else: surface server message if available
  const serverMsg =
    (typeof json === 'object' && json && (json as any).error) || raw || res.statusText;
  setError(`Failed to load posts (${res.status}) ${serverMsg}`.trim());
  setHasMore(false);
  return;
}


    // Accept several shapes: array, {posts: [...]}, {data:{posts:[...]}}
    const rows: PostRow[] = Array.isArray(json)
      ? json
      : Array.isArray((json as any).posts)
      ? (json as any).posts
      : Array.isArray((json as any).data?.posts)
      ? (json as any).data.posts
      : [];

    if (kind === 'first') {
      setPosts(rows);
      setOffset(rows.length);
    } else {
      setPosts(prev => [...prev, ...rows]);
      setOffset(prev => prev + rows.length);
    }

    setHasMore(rows.length === pageSize);
  } catch (e: any) {
    console.error('Posts fetch failed:', e);
    setError(e?.message || 'Failed to load posts');
  } finally {
    kind === 'first' ? setLoading(false) : setLoadingMore(false);
  }
};


  useEffect(() => {
    if (!groupId) return;
    fetchPage('first');
  }, [groupId, pageSize, refreshKey]);

  if (!groupId) return null;
  const handleProfileClick = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`);
      if (!res.ok) throw new Error("Profile not found");
      const data = await res.json();
      setViewingProfile(data);
    } catch (err) {
      setMessage("Failed to load profile");
      console.error(err);
    }
  };
  const handleCommentCountChange = (postId: number, newCount: number) => {
    setPosts(prev =>
      prev.map(p => p.post_id === postId ? { ...p, comment_count: newCount } : p)
    );
  };
  return (
  <div className="space-y-4">
      {/* Error */}
      {error && (
        <div className="px-3 py-2 text-sm rounded-md bg-[rgba(255,99,71,.08)] border border-[rgba(255,99,71,.35)] text-[#ffd6d6]">
          <div className="flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              className="px-2 py-1 rounded border border-white/10 hover:border-[rgba(0,255,255,.35)]"
              onClick={() => fetchPage('first')}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Empty */}
      {!loading && posts.length === 0 && !error && (
        <div className="text-center py-12 text-[#aab9c2]">
          <p className="text-lg">No posts yet</p>
        </div>
      )}

      {/* List */}
      {posts.map(p => {
        const name =
          p.nickname?.trim() ||
          `${(p.firstName || '').trim()} ${(p.lastName || '').trim()}`.trim() ||
          p.user_id;
        const a = avatarUrlFor(p.avatar);
        const img = imageUrlFor(p.image);

        return (
          <article
            key={p.post_id}
            className="rounded-xl p-2 border bg-[#1b1b1b] border-[rgba(255,0,255,.35)]"
          >
            <header className="flex items-center gap-3 mb-3">
              {a ? (
                <img
                  src={a}
                  alt={`${name} avatar`}
                  className="w-10 h-10 rounded-full object-cover border border-white/10 cursor-pointer hover:border-[rgba(255,0,255,.35)] transition"
                  onClick={() => handleProfileClick(p.user_id)}
                />
              ) : (
                <div
                  className="grid place-items-center w-10 h-10 rounded-full text-black font-semibold cursor-pointer hover:scale-105 transition"
                  style={{ background: 'radial-gradient(circle at 30% 30%, #ff66ff, #ffb3ff)' }}
                  onClick={() => handleProfileClick(p.user_id)}
                >
                  {initials(name)}
                </div>
              )}
              <div className="min-w-0">
                <div 
                  className="text-sm font-semibold truncate cursor-pointer hover:text-[#aaccff] transition"
                  onClick={() => handleProfileClick(p.user_id)}
                >
                  {name}
                </div>
                <div className="text-[11px] text-[#aab]">{relTime(p.created_at)}</div>
              </div>
            </header>

            {p.content && (
              <div className="whitespace-pre-wrap text-[0.95rem] leading-6 mb-3 break-words">
                {p.content}
              </div>
            )}

            {img && (
              <div className="mt-3">
                <img
                  src={img}
                  alt="Post image"
                  className="rounded-lg border border-white/10 max-h-[420px] object-contain w-full bg-black/20"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            )}

            <footer className="mt-4 text-[12px] text-[#8aa] flex items-center gap-3">
              <button
                onClick={() => toggleComments(p.post_id)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 hover:border-[rgba(0,255,255,.35)] hover:bg-[#232323] transition"
              >
                 💬 {p.comment_count ?? 0}
              </button>
            </footer>

            {openComments[p.post_id] && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <CommentThread
                 postId={p.post_id} 
                 onCountChange={handleCommentCountChange} 
                 />
              </div>
            )}
          </article>
        );
      })}

      {/* Load more */}
      {hasMore && posts.length > 0 && (
        <div className="pt-2 flex justify-center">
          <button
            disabled={loadingMore}
            onClick={() => fetchPage('more')}
            className={cls(
              'px-6 py-2 rounded-xl border text-sm transition',
              loadingMore
                ? 'opacity-60 bg-[#232323] border-white/10'
                : 'bg-[#1b1b1b] border-[rgba(255,0,255,.35)] hover:-translate-y-[1px] hover:bg-[#232323]'
            )}
          >
            {loadingMore ? 'Loading…' : 'Load more posts'}
          </button>
        </div>
      )}

{ViewingProfile && (
  <div className='fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/70'>
    <div className='relative w-full max-w-md'>
      <button
        className='absolute -top-10 -right-7 text-white hover:text-gray-300 text-2xl transition-colors'
        onClick={() => setViewingProfile(null)}
      >
        ✕
      </button>

      {(() => {
        // Build a normalized User object that ProfileCard can use for initials/fallbacks
        const displayName =
          (ViewingProfile.nickname && ViewingProfile.nickname.trim()) ||
          `${(ViewingProfile.firstName || '').trim()} ${(ViewingProfile.lastName || '').trim()}`.trim() ||
          ViewingProfile.id;

        const normalizedUser: User = {
          id: ViewingProfile.id,
          name: displayName,
          firstName: ViewingProfile.firstName || '',
          lastName: ViewingProfile.lastName || '',
          nickname: ViewingProfile.nickname || '',
          avatar: ViewingProfile.avatar || '',  // empty means "no avatar"
          // the rest are optional on your User type:
          online: ViewingProfile.online,
          isPublic: ViewingProfile.isPublic,
        };

        // Strong avatar fallback just for this file
        const avatarUrl =
          ViewingProfile.avatar
            ? (ViewingProfile.avatar.startsWith('/')
                ? ViewingProfile.avatar
                : `/avatars/${ViewingProfile.avatar}`)
            : '/avatars/avatar.jpeg';

        return (
          <ProfileCard
            user={normalizedUser}
            avatarUrl={avatarUrl}
            name={displayName}
            nickname={ViewingProfile.nickname}
            userId={ViewingProfile.id}
            onContactClick={() => {}}
          />
        );
      })()}
    </div>
  </div>
)}

    </div>
  );
}
