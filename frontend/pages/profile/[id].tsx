import Head from "next/head";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Pencil } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";

import Navbar from "../../components/ui/navbar";
import InfoCard from "../../components/profile/infoCard";
import FollowRequests from "../../components/profile/FollowRequests";
import ProfileCard from "@/components/profile/ProfileCard";
import { User, UserProfile as UserProfileType } from "@/types/user";

type Post = {
  user_id: string;
  post_id: string;
  nickname: string;
  content: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  image: string;
  privacy: "public" | "followers" | "custom";
  created_at: string;
  comment_count?: string;
  like_count?: string;
  is_liked?: boolean;
  following_likes?: string[];
};

type Comment = {
  user_id: string;
  nickname: string;
  firstName?: string;
  lastName?: string;
  text: string;
  image?: string;
  created_at: string;
  avatar?: string;
};

type CommentDraft = {
  content: string;
  imageFile: File | null;
  previewUrl: string | null;
};

const avatarUrlFor = (avatar?: string) =>
  avatar ? (avatar.startsWith("/") ? avatar : `/avatars/${avatar}`) : null;

const relTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return `${Math.max(s, 1)}s`;
};

const getGroupId = (obj: any) => String(obj?.groupId ?? obj?.groupID ?? obj?.group_id ?? "");

export default function ProfilePage() {
  const router = useRouter();
  const { id } = router.query;

  const [profile, setProfile] = useState<UserProfileType | null>(null);
  const [me, setMe] = useState<User | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [posts, setPosts] = useState<Post[]>([]);
  const [isPublic, setIsPublic] = useState<boolean | null>(null);

  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const isCurrentUser = useMemo(() => String(id || "") === String(currentUserId || ""), [id, currentUserId]);

  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [showRequests, setShowRequests] = useState(false);

  const [canViewProfile, setCanViewProfile] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [requestRefresh, setRequestRefresh] = useState(0);

  // UI states keyed by POST ID (not idx)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [likesOptimistic, setLikesOptimistic] = useState<Record<string, number>>({});

  // comment drafts per post
  const [commentDrafts, setCommentDrafts] = useState<Record<string, CommentDraft>>({});
  const commentFileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [ViewingProfile, setViewingProfile] = useState<UserProfileType | null>(null);

  // Users map for notification name resolve
  const [users, setUsers] = useState<UserProfileType[]>([]);
  const usersMapRef = useRef<Record<string, UserProfileType>>({});

  const postIdKey = (pid: string | number) => String(pid);

  const setDraft = useCallback((pid: string, patch: Partial<CommentDraft>) => {
    setCommentDrafts((prev) => {
      const cur = prev[pid] ?? { content: "", imageFile: null, previewUrl: null };
      // revoke old preview if replacing
      if (patch.previewUrl && cur.previewUrl && cur.previewUrl !== patch.previewUrl) {
        URL.revokeObjectURL(cur.previewUrl);
      }
      if (patch.imageFile === null && cur.previewUrl) {
        URL.revokeObjectURL(cur.previewUrl);
      }
      return { ...prev, [pid]: { ...cur, ...patch } };
    });
  }, []);

  const clearDraft = useCallback((pid: string) => {
    setCommentDrafts((prev) => {
      const cur = prev[pid];
      if (cur?.previewUrl) URL.revokeObjectURL(cur.previewUrl);
      const copy = { ...prev };
      delete copy[pid];
      return copy;
    });
    if (commentFileRefs.current[pid]) commentFileRefs.current[pid]!.value = "";
  }, []);

  // ---------- Reset on route change ----------
  useEffect(() => {
    setViewingProfile(null);
    setOpenComments({});
    setComments({});
    setExpanded({});
    setLightboxSrc(null);
  }, [id]);

  // ---------- Load current user ----------
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        setCurrentUserId(String(data.id));
      } catch (err) {
        console.error("Error fetching current user:", err);
      }
    })();
  }, [router]);

  // ---------- Load "me" for navbar ----------
  useEffect(() => {
    if (!currentUserId) return;
    (async () => {
      try {
        const resUser = await fetch(`/api/users/${currentUserId}/user`, { credentials: "include" });
        if (resUser.ok) setMe(await resUser.json());
      } catch (error) {
        console.error("Failed to load current user", error);
      }
    })();
  }, [currentUserId]);

  const fetchFollowCounts = useCallback(async () => {
    if (!id || typeof id !== "string") return;
    try {
      const res = await fetch(`/api/users/${id}/follow-counts`);
      if (res.ok) {
        const data = await res.json();
        setFollowerCount(Number(data.follower_count || 0));
        setFollowingCount(Number(data.following_count || 0));
      }
    } catch (error) {
      console.error("Error fetching follow counts:", error);
    }
  }, [id]);

  const fetchPendingRequestsCount = useCallback(async () => {
    if (!currentUserId || String(currentUserId) !== String(id)) return;
    try {
      const res = await fetch("/api/users/pending-requests", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPendingRequestCount(data?.requests?.length || 0);
      }
    } catch (error) {
      console.error("Error fetching pending requests:", error);
    }
  }, [currentUserId, id]);

  // ---------- Main profile + posts ----------
  const fetchData = useCallback(async () => {
    if (!id || typeof id !== "string") return;

    setLoading(true);
    setError("");

    try {
      const profileRes = await fetch(`/api/users/${id}`, { credentials: "include" });
      if (!profileRes.ok) throw new Error("Profile not found");
      const profileData = await profileRes.json();

      let postsData: Post[] = [];
      try {
        const postsRes = await fetch(`/api/users/${id}/posts`, { credentials: "include" });
        postsData = postsRes.ok ? await postsRes.json() : [];
        if (!Array.isArray(postsData)) postsData = [];
      } catch (postsError) {
        console.error("Error fetching posts:", postsError);
        postsData = [];
      }

      const profileIsPublic = Boolean(profileData?.is_public);
      setIsPublic(profileIsPublic);

      setProfile({
        ...profileData,
        postCount: postsData.length,
        is_public: profileIsPublic,
      });

      setPosts(postsData);

      // hydrate liked state keyed by postId
      const likedState: Record<string, boolean> = {};
      const likesState: Record<string, number> = {};
      postsData.forEach((p) => {
        const k = postIdKey(p.post_id);
        likedState[k] = Boolean(p.is_liked);
        likesState[k] = Number(p.like_count || 0);
      });
      setLikedPosts(likedState);
      setLikesOptimistic(likesState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData, followerCount, refreshTrigger]);

  useEffect(() => {
    fetchFollowCounts();
  }, [fetchFollowCounts, refreshTrigger]);

  useEffect(() => {
    fetchPendingRequestsCount();
  }, [fetchPendingRequestsCount, refreshTrigger, requestRefresh]);

  // ---------- Profile access check ----------
  useEffect(() => {
    const checkProfileAccess = async () => {
      if (!currentUserId) {
        setCanViewProfile(false);
        return;
      }
      if (!id || String(currentUserId) === String(id)) {
        setCanViewProfile(true);
        return;
      }

      try {
        const followRes = await fetch(`/api/users/follow-status?following_id=${id}`, {
          credentials: "include",
        });
        if (followRes.ok) {
          const followData = await followRes.json();
          if (isPublic === false && followData.status !== "accepted") setCanViewProfile(false);
          else setCanViewProfile(true);
        } else {
          setCanViewProfile(false);
        }
      } catch (error) {
        console.error("Error checking profile access:", error);
        setCanViewProfile(false);
      }
    };

    if (id && currentUserId && isPublic !== null) checkProfileAccess();
  }, [id, currentUserId, isPublic, refreshTrigger]);

  const handleFollowUpdate = useCallback(() => {
    fetchFollowCounts();
    setRefreshTrigger((p) => p + 1);
    setRequestRefresh((p) => p + 1);
    fetchData();
    if (currentUserId && String(currentUserId) === String(id)) fetchPendingRequestsCount();
  }, [fetchFollowCounts, fetchData, currentUserId, id, fetchPendingRequestsCount]);

  const handleChangeAccountStatus = useCallback(async () => {
    if (!currentUserId || String(currentUserId) !== String(id)) return;
    try {
      const res = await fetch("/api/users/toggle-privacy", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        const newIsPublic = Boolean(data.isPublic);
        setIsPublic(newIsPublic);
        setProfile((prev) => (prev ? { ...prev, is_public: newIsPublic } : prev));
      }
    } catch (error) {
      console.error("Error toggling privacy:", error);
    }
  }, [currentUserId, id]);

  // ---------- Comments ----------
  const fetchComments = useCallback(
    async (postId: string) => {
      try {
        const formData = new FormData();
        formData.append("post_id", postId);

        const res = await fetch("/api/comments", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch comments");
        const data: Comment[] = await res.json();

        setComments((prev) => ({ ...prev, [postId]: Array.isArray(data) ? data : [] }));
      } catch (error) {
        console.error("Error fetching comments:", error);
      }
    },
    []
  );

  const submitComment = useCallback(
    async (e: React.FormEvent, postId: string) => {
      e.preventDefault();

      const draft = commentDrafts[postId];
      const content = draft?.content?.trim() || "";
      if (!content) return;

      const formData = new FormData();
      formData.append("content", content);
      formData.append("post_id", postId);
      if (draft?.imageFile) formData.append("image", draft.imageFile);

      const res = await fetch("/api/comments", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (res.ok) {
        clearDraft(postId);
        await fetchComments(postId);
        fetchData(); // refresh comment_count
      }
    },
    [commentDrafts, clearDraft, fetchComments, fetchData]
  );

  const setCommentImageFile = useCallback(
    (postId: string, file: File | null) => {
      if (file) {
        const url = URL.createObjectURL(file);
        setDraft(postId, { imageFile: file, previewUrl: url });
      } else {
        setDraft(postId, { imageFile: null, previewUrl: null });
      }
    },
    [setDraft]
  );

  // ---------- Likes ----------
  const handleLike = useCallback(
    async (postId: string) => {
      const liked = Boolean(likedPosts[postId]);
      setLikedPosts((prev) => ({ ...prev, [postId]: !liked }));
      setLikesOptimistic((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + (liked ? -1 : 1) }));

      try {
        const formData = new FormData();
        formData.append("post_id", postId);

        const res = await fetch("/api/likes", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to like post");
        fetchData();
      } catch (error) {
        // rollback
        setLikedPosts((prev) => ({ ...prev, [postId]: liked }));
        setLikesOptimistic((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + (liked ? 1 : -1) }));
        console.error("Error liking post:", error);
      }
    },
    [likedPosts, fetchData]
  );

  // ---------- Inline Profile modal ----------
  const handleProfileClick = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`);
      if (!res.ok) throw new Error("Profile not found");
      const data = await res.json();
      setViewingProfile(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // ---------- Follow requests intent ----------
  useEffect(() => {
    if (!id || !currentUserId) return;
    const intent = localStorage.getItem("intent:openFollowRequests");
    if (intent && String(id) === String(currentUserId)) {
      setShowRequests(true);
      fetchPendingRequestsCount?.();
      localStorage.removeItem("intent:openFollowRequests");
    }
  }, [id, currentUserId, fetchPendingRequestsCount]);

  // ---------- Users list for notifications ----------
  useEffect(() => {
    if (!currentUserId) return;
    (async () => {
      try {
        const r = await fetch("/api/users", { credentials: "include" });
        const arr = (await r.json()) || [];
        const cleaned: UserProfileType[] = (Array.isArray(arr) ? arr : [])
          .filter((u: any) => u?.id && String(u.id) !== String(currentUserId))
          .map((u: any) => ({
            id: String(u.id),
            firstName: u.firstName ?? u.firstname ?? "",
            lastName: u.lastName ?? u.last_name ?? u.last_Name ?? "",
            nickname: u.nickname ?? "",
            email: u.email ?? "",
            dob: u.dob ?? "",
            aboutMe: u.aboutMe ?? u.about_me ?? "",
            avatar: u.avatar ?? "",
          }));
        setUsers(cleaned);
      } catch {
        /* non-fatal */
      }
    })();
  }, [currentUserId]);

  useEffect(() => {
    const m: Record<string, UserProfileType> = {};
    for (const u of users) m[String(u.id)] = u;
    usersMapRef.current = m;
  }, [users]);

  const resolveSenderName = useCallback((fromId: string, content: any): string => {
    const u = usersMapRef.current[String(fromId)];
    const stateName =
      u?.nickname || [u?.firstName, (u as any)?.lastName ?? (u as any)?.last_Name].filter(Boolean).join(" ");
    const payloadName =
      content?.nickname ||
      [content?.firstName, content?.lastName ?? content?.last_Name].filter(Boolean).join(" ");

    return (stateName || payloadName || `@${fromId}`).trim();
  }, []);

  const goGroupPanel = useCallback(
    (groupId?: string) => {
      if (groupId) localStorage.setItem("intent:groupId", String(groupId));
      localStorage.setItem("intent:openGroupPanel", "1");
      router.push("/messages");
    },
    [router]
  );

  const onGroupEventCreated = useCallback(
    (payload: any) => {
      const gTitle = payload?.groupTitle ?? payload?.groupName ?? "your group";
      const gid = getGroupId(payload);
      toast.success(`📅 New event in ${gTitle}`, {
        onClick: () => goGroupPanel(gid),
        closeOnClick: true,
      });
    },
    [goGroupPanel]
  );

  // ---------- WS notifications ----------
  useEffect(() => {
    if (!currentUserId) return;

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const hostOnly = window.location.hostname;
    const ws = new WebSocket(`${proto}://${hostOnly}:8080/ws`);

    ws.onmessage = (ev: MessageEvent) => {
      try {
        const env = JSON.parse(ev.data);

        if (env.type === "notification.created") {
          const n = env.data as { id?: number; type: string; content: any };

          if (n.type === "dm") {
            const fromId = String(n.content?.from ?? "");
            const text = String(n.content?.text ?? "");
            if (!fromId) return;
            if (fromId === String(currentUserId)) return;

            const name = resolveSenderName(fromId, n.content);
            toast.info(`${name}: ${text}`, {
              onClick: () => {
                localStorage.setItem("intent:openDM", fromId);
                router.push("/messages");
              },
            });
          }

          if (n.type === "group_event_created") {
            onGroupEventCreated(n.content || {});
            return;
          }

          if (n.type === "follow_request") {
            const followerId = String(n.content?.followerId ?? "");
            const name =
              n.content?.nickname ||
              [n.content?.firstName, n.content?.lastName].filter(Boolean).join(" ") ||
              `@${followerId}`;

            toast.info(`New follow request from ${name}`);
            setRequestRefresh((prev) => prev + 1);
            if (String(currentUserId) === String(id)) fetchPendingRequestsCount();
          }

          if (n.type === "follow_request.update") {
            const status = String(n.content?.status ?? "");
            const followingId = String(n.content?.followingId ?? "");

            if (status === "accepted") {
              toast.success("Follow request accepted");
              if (String(id) === followingId) {
                setCanViewProfile(true);
                handleFollowUpdate();
              }
            } else if (status === "declined") {
              toast.error("Follow request declined");
            }
          }
        }
      } catch {
        /* ignore */
      }
    };

    return () => ws.close();
  }, [currentUserId, id, router, resolveSenderName, onGroupEventCreated, fetchPendingRequestsCount, handleFollowUpdate]);

  // ---------- UI guards ----------
  if (loading || isPublic === null) return <div className="bg-black w-[100vw] h-[100vh]">Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!profile) return <div>Profile not found</div>;

  const canSee = canViewProfile || isCurrentUser;

  const FollowedLikes: React.FC<{ post: Post }> = ({ post }) => {
    const [showAll, setShowAll] = useState(false);
    const likes = post.following_likes || [];
    if (likes.length === 0) return null;

    const text =
      !showAll && likes.length > 2
        ? `${likes[0]}, ${likes[1]} and ${likes.length - 2} more people you follow liked this post`
        : !showAll && likes.length === 2
        ? `${likes[0]} and ${likes[1]} liked this post`
        : `${likes.join(", ")} liked this post`;

    return (
      <div
        className="text-sm text-white/60 cursor-pointer mt-1"
        onClick={() => likes.length > 2 && setShowAll((s) => !s)}
        title={likes.join(", ")}
      >
        {text}
      </div>
    );
  };

  const neonBG = (
    <div
      aria-hidden="true"
      className="fixed -inset-[50vh] z-0 pointer-events-none blur-[20px] saturate-[1.2] animate-[glowMove_28s_linear_infinite]"
      style={{
        background: `radial-gradient(42rem 42rem at 20% 25%, rgba(0,255,255,0.12), transparent 60%),
                     radial-gradient(36rem 36rem at 80% 70%, rgba(255,0,255,0.10), transparent 60%),
                     radial-gradient(30rem 30rem at 60% 30%, rgba(0,255,153,0.10), transparent 60%),
                     radial-gradient(24rem 24rem at 40% 80%, rgba(0,140,255,0.08), transparent 60%)`,
      }}
    />
  );

  // ---------- Render ----------
  return canSee ? (
    <>
      <Head>
        <title>{profile.nickname ? `@${profile.nickname}` : `${profile.firstName} ${profile.lastName}`}</title>
      </Head>

      <div className="w-full min-h-screen mx-auto p-4 md:p-8 bg-black flex justify-center items-center">
        {neonBG}
        <Navbar user={me} />

        <div className="w-full flex flex-col gap-8 max-w-6xl relative mt-20 z-10">
          {/* Notification center */}
          {String(currentUserId) === String(id) && (
            <div className="absolute top-0 right-0 z-30 m-5 flex items-center gap-4">
              <button
                onClick={() => router.push("/profile/edit")}
                title="Edit Profile"
                className="relative p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 shadow-[0_0_12px_rgba(0,255,255,0.35)] hover:bg-white/20 hover:shadow-[0_0_18px_rgba(0,255,255,0.5)] transition-all text-white"
              >
                <Pencil className="h-6 w-6 text-white" />
              </button>

              <button
                onClick={() => setShowRequests((s) => !s)}
                className="relative p-3 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-colors"
                title="Follow Requests"
              >
                <Bell className="h-6 w-6 text-white" />
                {pendingRequestCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {pendingRequestCount}
                  </span>
                )}
              </button>

              {showRequests && (
                <div className="absolute top-12 right-0 w-[22rem] bg-black/90 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl z-20 mt-2 overflow-hidden">
                  <FollowRequests
                    onRequestHandled={() => {
                      fetchPendingRequestsCount();
                      handleFollowUpdate();
                      setRequestRefresh((prev) => prev + 1);
                    }}
                    onAccessChange={(status) => {
                      if (status === "accepted") setCanViewProfile(true);
                      setRequestRefresh((prev) => prev + 1);
                    }}
                    key={refreshTrigger + requestRefresh}
                  />
                </div>
              )}
            </div>
          )}

          {/* Profile Hero */}
          <div className="w-full mx-auto">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-[0_0_18px_rgba(0,255,255,0.12),0_0_28px_rgba(255,0,255,0.08)]">
              <div className="absolute inset-0 bg-gradient-to-br from-[#041014] via-black to-[#12041a]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(0,255,255,0.14),transparent_60%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_65%,rgba(255,0,255,0.10),transparent_55%)]" />
              <div
                className="absolute top-0 left-0 w-full h-[55%] backdrop-blur-md"
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(0,0,0,0.65), rgba(0,0,0,0.25), transparent)",
                }}
              />

              <div className="relative z-10 p-4 sm:p-6 md:p-8">
                <InfoCard
                  avatarUrl={
                    profile.avatar
                      ? profile.avatar.startsWith("/")
                        ? profile.avatar
                        : `/avatars/${profile.avatar}`
                      : ""
                  }
                  name={`${profile.firstName} ${profile.lastName}`}
                  email={profile.email}
                  dob={profile.dob || ""}
                  about={profile.aboutMe || ""}
                  nickname={profile.nickname}
                  postCount={profile.postCount}
                  userId={id as string}
                  currentUserId={currentUserId}
                  isPublic={isPublic}
                  onTogglePrivacy={handleChangeAccountStatus}
                  followerCount={followerCount}
                  followingCount={followingCount}
                  onFollowUpdate={handleFollowUpdate}
                  key={refreshTrigger}
                  canViewProfile={canViewProfile}
                />
              </div>
            </div>
          </div>

          {/* Posts wrapper */}
          <div className="w-full mx-auto">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-[0_0_18px_rgba(0,255,255,0.10),0_0_28px_rgba(255,0,255,0.08)]">
              <div className="absolute inset-0 bg-gradient-to-br from-[#041014] via-black to-[#12041a]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(0,255,255,0.12),transparent_60%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_65%,rgba(255,0,255,0.10),transparent_55%)]" />
              <div
                className="absolute top-0 left-0 w-full h-[55%] backdrop-blur-md"
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(0,0,0,0.65), rgba(0,0,0,0.25), transparent)",
                }}
              />

              <div className="relative z-10 p-6">
                <h2 className="text-xl font-bold text-white mb-3">Posts</h2>

                {!posts || posts.length === 0 ? (
                  <div className="bg-white/5 rounded-xl p-12 backdrop-blur-sm border border-white/10 min-h-[200px] flex items-center justify-center">
                    <p className="text-white/60">No posts yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {posts.map((post, idx) => {
                      const postId = postIdKey(post.post_id);

                      const displayName =
                        post.nickname?.trim() ||
                        ([post.firstName, post.lastName].filter(Boolean).join(" ").trim() || post.user_id);

                      const initial = displayName.charAt(0)?.toUpperCase() || "?";
                      const imgSrc = post.image ? `/uploads/${post.image}` : null;
                      const cList = comments[postId] || [];
                      const avatarUrl = post.avatar ? (post.avatar.startsWith("/") ? post.avatar : `/avatars/${post.avatar}`) : null;

                      const draft = commentDrafts[postId] ?? { content: "", imageFile: null, previewUrl: null };
                      const isOpen = Boolean(openComments[postId]);
                      const isExpanded = Boolean(expanded[postId]);

                      return (
                        <div
                          key={postId}
                          className="opacity-1 [animation-name:fadeUpScale] [animation-duration:700ms] [animation-timing-function:cubic-bezier(.22,.61,.36,1)] [animation-fill-mode:forwards] will-change-[transform,opacity,filter] bg-[linear-gradient(180deg,#181818,#151515)] p-4 pb-3.5 relative overflow-hidden border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-[0_0_8px_rgba(0,255,255,0.15),0_0_18px_rgba(255,0,255,0.12)]"
                          style={{ animationDelay: `${idx * 70}ms` }}
                        >
                          {/* animated border */}
                          <div
                            className="absolute inset-0 rounded-2xl pointer-events-none"
                            style={{
                              padding: 1.2,
                              background:
                                "conic-gradient(from 90deg, rgba(0,255,255,.6), rgba(255,0,255,.55), rgba(0,255,153,.55), rgba(0,255,255,.6))",
                              backgroundSize: "180% 180%",
                              animation: "borderFlow 10s linear infinite",
                              WebkitMask:
                                "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                              WebkitMaskComposite: "xor",
                              maskComposite: "exclude",
                            }}
                          />

                          {/* header */}
                          <div className="flex items-center justify-between gap-3 mb-1.5">
                            <div className="flex items-center gap-3">
                              {avatarUrl ? (
                                <img
                                  src={avatarUrl}
                                  alt={`${displayName} avatar`}
                                  className="w-12 h-12 rounded-full object-cover shadow-[0_0_10px_rgba(0,255,255,.25)] border border-[rgba(255,255,255,0.08)]"
                                  loading="lazy"
                                  decoding="async"
                                />
                              ) : (
                                <div
                                  className="grid place-items-center rounded-full font-bold uppercase text-black w-12 h-12 text-[1.1rem] shadow-[0_0_10px_rgba(0,255,255,.25)]"
                                  aria-hidden="true"
                                  style={{
                                    background:
                                      "radial-gradient(circle at 30% 30%, #00ffcc, #66ffff), #00ffcc",
                                  }}
                                >
                                  {initial}
                                </div>
                              )}

                              <div>
                                <strong className="text-[1.05rem] text-white font-bold">{displayName}</strong>
                                <div className="flex items-center gap-2 text-[#9aa] text-[0.85rem]">
                                  <span>{relTime(post.created_at)}</span>
                                  <span className="w-1 h-1 rounded-full bg-[#666] opacity-80" />
                                  <span>{new Date(post.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>

                            <span
                              className={[
                                "px-2 py-[0.15rem] rounded-full text-[0.75rem] font-semibold border bg-[#191919] text-[#cfe] tracking-[0.2px]",
                                post.privacy === "public"
                                  ? "border-[rgba(0,255,255,.35)]"
                                  : post.privacy === "followers"
                                  ? "border-[rgba(255,0,255,.35)]"
                                  : "border-[rgba(0,255,153,.35)]",
                              ].join(" ")}
                            >
                              {post.privacy}
                            </span>
                          </div>

                          {/* content */}
                          <p
                            className={
                              isExpanded
                                ? "text-[#eaeaea] leading-[1.5] break-words"
                                : "overflow-hidden [display:-webkit-box] [-webkit-line-clamp:4] [-webkit-box-orient:vertical] text-[#eaeaea] leading-[1.5] break-words"
                            }
                          >
                            {post.content}
                          </p>

                          {post.content && post.content.length > 500 && (
                            <button
                              className="bg-transparent border-0 text-[#9ad] cursor-pointer p-0 mt-1 font-semibold text-[0.9rem] hover:underline"
                              onClick={() => setExpanded((p) => ({ ...p, [postId]: !p[postId] }))}
                            >
                              {isExpanded ? "See less" : "See more"}
                            </button>
                          )}

                          {/* image */}
                          {imgSrc && (
                            <img
                              src={imgSrc}
                              alt="Post"
                              className="w-full rounded-[12px] max-h-[420px] object-cover my-2 shadow-[0_8px_20px_rgba(0,0,0,.35)] transition hover:scale-[1.02] hover:shadow-[0_12px_28px_rgba(0,0,0,.45)] cursor-zoom-in"
                              onClick={() => setLightboxSrc(imgSrc)}
                            />
                          )}

                          {/* actions */}
                          <div className="flex items-center gap-2.5 pt-2 pb-1 px-1">
                            <button
                              type="button"
                              onClick={() => handleLike(postId)}
                              className="inline-flex items-center gap-2 rounded-[10px] bg-[#232323] text-[#eee] border border-[rgba(255,255,255,0.12)] px-3 py-1.5 cursor-pointer font-semibold text-[0.9rem] transition hover:-translate-y-[1px] hover:border-[rgba(0,255,255,.35)] hover:bg-[#2a2a2a]"
                            >
                              {likedPosts[postId] ? "❤️" : "🤍"}
                              <span className="opacity-85">{likesOptimistic[postId] ?? Number(post.like_count || 0)}</span>
                            </button>

                            <button
                              type="button"
                              className="inline-flex items-center gap-2 rounded-[10px] bg-[#232323] text-[#eee] border border-[rgba(255,255,255,0.12)] px-3 py-1.5 cursor-pointer font-semibold text-[0.9rem] transition hover:-translate-y-[1px] hover:border-[rgba(0,255,255,.35)] hover:bg-[#2a2a2a]"
                              onClick={() => {
                                if (!isOpen) fetchComments(postId);
                                setOpenComments((prev) => ({ ...prev, [postId]: !prev[postId] }));
                              }}
                              aria-expanded={isOpen}
                              aria-controls={`comments-${postId}`}
                            >
                              💬 <span className="opacity-85">{Number(post.comment_count || 0)}</span>
                            </button>
                          </div>

                          <FollowedLikes post={post} />

                          {/* comments panel */}
                          {isOpen && (
                            <div
                              id={`comments-${postId}`}
                              className="mt-2.5 p-3 text-white rounded-[12px] bg-[#191919] border border-[rgba(255,255,255,0.08)]"
                            >
                              <form onSubmit={(e) => submitComment(e, postId)}>
                                <div className="flex flex-col items-start gap-2">
                                  <div className="flex items-center gap-2 w-full">
                                    <textarea
                                      value={draft.content}
                                      onChange={(e) => setDraft(postId, { content: e.target.value })}
                                      name="content"
                                      placeholder="Write a comment"
                                      rows={2}
                                      required
                                      className="flex-1 bg-[#232323] text-white border border-[#444] rounded-[10px] px-3 py-2 resize-none"
                                    />
                                    <button
                                      type="submit"
                                      className="inline-flex items-center gap-2 rounded-[10px] bg-[#232323] text-[#eee] border border-[rgba(255,255,255,0.12)] px-3 py-1.5 cursor-pointer font-semibold text-[0.9rem] transition hover:-translate-y-[1px] hover:border-[rgba(0,255,255,.35)] hover:bg-[#2a2a2a] whitespace-nowrap"
                                    >
                                      Send
                                    </button>
                                  </div>

                                  <div className="mb-2 w-full rounded-lg p-4 bg-[#151515] border border-dashed border-[#555] overflow-hidden">
                                    <div className="flex justify-between w-full items-center gap-2">
                                      <div className="flex-1">
                                        <div className="font-semibold mb-1">Add an image</div>
                                        <div className="text-sm text-[#888]">Click “Choose” to attach</div>
                                        {draft.imageFile && (
                                          <div className="text-xs text-[#ccc] mt-1">{draft.imageFile.name}</div>
                                        )}
                                      </div>
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          className="px-3 py-1.5 text-[0.85rem] rounded-md border-0 cursor-pointer bg-[#0ff] text-black"
                                          onClick={() => commentFileRefs.current[postId]?.click()}
                                        >
                                          Choose
                                        </button>
                                        {draft.imageFile && (
                                          <button
                                            type="button"
                                            className="px-3 py-1.5 text-[0.85rem] rounded-md border-0 cursor-pointer bg-[#232323] text-white"
                                            onClick={() => clearDraft(postId)}
                                          >
                                            Remove
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <input
                                    ref={(el) => {
                                      commentFileRefs.current[postId] = el;
                                    }}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0] ?? null;
                                      if (file && file.type.startsWith("image/")) setCommentImageFile(postId, file);
                                    }}
                                  />

                                  {draft.previewUrl && (
                                    <img
                                      src={draft.previewUrl}
                                      alt="Preview"
                                      className="block max-w-full max-h-[240px] mt-2 rounded-lg object-contain bg-black"
                                    />
                                  )}
                                </div>
                              </form>

                              {cList.length === 0 ? (
                                <div className="text-[#9aa] text-[0.9rem] mt-2">Be the first to comment.</div>
                              ) : (
                                <div className="grid gap-2 mt-3">
                                  {cList.map((c, i) => {
                                    const displayName =
                                      c.nickname?.trim() ||
                                      ([c.firstName, c.lastName].filter(Boolean).join(" ").trim() || c.user_id);

                                    const initial = displayName.charAt(0)?.toUpperCase() || "?";
                                    const cAvatar = avatarUrlFor(c.avatar) || null;
                                    const cImg = c.image ? `/uploads/${c.image}` : null;

                                    return (
                                      <div key={i} className="grid gap-1">
                                        <div className="flex items-center gap-2">
                                          {cAvatar ? (
                                            <img
                                              src={cAvatar}
                                              alt={`${displayName} avatar`}
                                              className="w-[38px] h-[38px] rounded-full object-cover shadow-[0_0_10px_rgba(0,255,255,.25)] border border-[rgba(255,255,255,0.08)]"
                                              loading="lazy"
                                              decoding="async"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                handleProfileClick(c.user_id);
                                              }}
                                            />
                                          ) : (
                                            <div
                                              className="grid place-items-center rounded-full font-bold uppercase text-black w-[38px] h-[38px] text-[0.95rem] shadow-[0_0_10px_rgba(0,255,255,.25)]"
                                              style={{
                                                background:
                                                  "radial-gradient(circle at 30% 30%, #00ffcc, #66ffff), #00ffcc",
                                              }}
                                              onClick={(e) => {
                                                e.preventDefault();
                                                handleProfileClick(c.user_id);
                                              }}
                                            >
                                              {initial}
                                            </div>
                                          )}

                                          <div
                                            className="font-bold cursor-pointer"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              handleProfileClick(c.user_id);
                                            }}
                                          >
                                            {displayName}
                                          </div>

                                          <div className="text-[#9aa] text-[0.8rem]">{relTime(c.created_at)}</div>
                                        </div>

                                        <div className="ml-[2.3rem] text-[#ddd] leading-[1.35] break-words [overflow-wrap:anywhere]">
                                          {c.text}
                                        </div>

                                        {cImg && (
                                          <img
                                            src={cImg}
                                            alt="Comment"
                                            className="w-full rounded-[12px] max-h-[210px] object-cover my-2 shadow-[0_8px_20px_rgba(0,0,0,.35)] transition hover:scale-[1.02] hover:shadow-[0_12px_28px_rgba(0,0,0,.45)] cursor-zoom-in"
                                            onClick={() => setLightboxSrc(cImg)}
                                          />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Lightbox */}
        {lightboxSrc && (
          <div
            className="fixed inset-0 z-[2000] bg-[rgba(0,0,0,.75)] grid place-items-center p-8 backdrop-blur-[4px]"
            onClick={() => setLightboxSrc(null)}
          >
            <button
              className="fixed top-[18px] right-[24px] text-white text-[1.4rem] bg-transparent border-0 cursor-pointer"
              aria-label="Close"
            >
              ✕
            </button>
            <img
              className="max-w-[92vw] max-h-[86vh] rounded-[12px] border border-[rgba(255,255,255,.15)] shadow-[0_30px_80px_rgba(0,0,0,.65),0_0_40px_rgba(0,255,255,.18)]"
              src={lightboxSrc}
              alt="Preview"
            />
          </div>
        )}

        {/* Inline profile viewer */}
        {ViewingProfile && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/70"
            onClick={() => setViewingProfile(null)}
          >
            <div className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <button
                className="absolute -top-10 -right-7 text-white hover:text-gray-300 text-2xl transition-colors"
                onClick={() => setViewingProfile(null)}
              >
                ✕
              </button>

              <ProfileCard
                user={
                  {
                    id: ViewingProfile.id,
                    name: `${ViewingProfile.firstName} ${ViewingProfile.lastName}`,
                    firstName: ViewingProfile.firstName,
                    lastName: ViewingProfile.lastName,
                    nickname: ViewingProfile.nickname,
                    avatar: ViewingProfile.avatar,
                    online: (ViewingProfile as any).online,
                    isPublic: (ViewingProfile as any).isPublic,
                  } as any
                }
                avatarUrl={
                  ViewingProfile.avatar
                    ? ViewingProfile.avatar.startsWith("/")
                      ? ViewingProfile.avatar
                      : `/avatars/${ViewingProfile.avatar}`
                    : "/avatars/avatar.jpeg"
                }
                name={`${ViewingProfile.firstName} ${ViewingProfile.lastName}`}
                nickname={ViewingProfile.nickname}
                userId={ViewingProfile.id}
                onContactClick={() => {}}
              />
            </div>
          </div>
        )}

        <ToastContainer
          position="bottom-left"
          autoClose={4000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="dark"
        />
      </div>
    </>
  ) : (
    // private view
    <div className="w-full min-h-screen mx-auto p-4 md:p-8 bg-black flex justify-center items-center">
      {neonBG}
      <Navbar user={me} />

      <div className="w-full mx-auto z-10">
        <InfoCard
          avatarUrl={
            profile.avatar ? (profile.avatar.startsWith("/") ? profile.avatar : `/avatars/${profile.avatar}`) : ""
          }
          name={`${profile.firstName} ${profile.lastName}`}
          nickname={profile.nickname}
          userId={id as string}
          currentUserId={currentUserId}
          isPublic={isPublic}
          onTogglePrivacy={handleChangeAccountStatus}
          onFollowUpdate={handleFollowUpdate}
          key={refreshTrigger}
          canViewProfile={false}
        />
      </div>

      <ToastContainer position="bottom-left" autoClose={4000} newestOnTop closeOnClick draggable pauseOnHover theme="dark" />
    </div>
  );
}
