import { useRouter } from "next/router";
import { useEffect, useRef, useState, useMemo } from "react";
import InfoCard from "../../components/profile/infoCard";
import FollowRequests from "../../components/profile/FollowRequests";
import ProfileCard from "@/components/profile/ProfileCard";
import { Bell } from "lucide-react";
import Navbar from "../../components/ui/navbar";
import { User, UserProfile as UserProfileType } from "@/types/user";
import { toast, ToastContainer } from "react-toastify";
import Head from "next/head";


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

export default function ProfilePage() {
  const router = useRouter();
  const { id } = router.query;

  const [profile, setProfile] = useState<UserProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
  const [comments, setComments] = useState<Record<number, Comment[]>>({});
  const [likes, setliked] = useState<Record<number, number>>({});
  const [likedPosts, setLikedPosts] = useState<Record<number, boolean>>({});
  const [drafs, setDrafts] = useState<Record<number, string>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState<boolean | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [showRequests, setShowRequests] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [canViewProfile, setCanViewProfile] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [nickname, setNickName] = useState<string>("");
  const [requestRefresh, setRequestRefresh] = useState(0);
  const [me, setMe] = useState<User | null>(null);
  const [ViewingProfile, setViewingProfile] = useState<UserProfileType | null>(null);

  const [users, setUsers] = useState<UserProfileType[]>([]);
  const usersMapRef = useRef<Record<string, UserProfileType>>({});

  const commentFileInputRef = useRef<HTMLInputElement | null>(null);
  const isCurrentUser = id === currentUserId;
  const [CommentForm, setCommentForm] = useState({
    postId: 0,
    user_Id: currentUserId,
    content: "",
    imageFile: null as File | null,
  });
  const [dragActiveComment, setDragActiveComment] = useState(false);
  const [previewUrlComment, setPreviewUrlComment] = useState<string | null>(null);

  const avatarUrlFor = (avatar?: string) =>
    avatar ? (avatar.startsWith("/") ? avatar : `/avatars/${avatar}`) : null;

  // ------------- Utils -------------
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


  const goMessagesDM = (peerId: string) => {
    localStorage.setItem("intent:openDM", peerId);
    router.push("/messages");
  };

  const goProfileFollowRequests = (myId: string) => {
    localStorage.setItem("intent:openFollowRequests", "1");
    router.push(`/profile/${myId}`);
  };

  const goGroupInvites = (groupId?: string) => {
    if (groupId) localStorage.setItem("intent:groupId", String(groupId));
    localStorage.setItem("intent:openGroupInvites", "1");
    router.push("/groups");
  };

  const goGroup = (groupId?: string) => {
    if (groupId) localStorage.setItem("intent:groupId", String(groupId));
    localStorage.setItem("intent:openGroup", "1");
    router.push("/groups");
  };

  const getGroupId = (obj: any) => String(obj?.groupId ?? obj?.groupID ?? obj?.group_id ?? "");

  // ---------- Effects ----------
  useEffect(() => {
    setViewingProfile(null);
    setOpenComments({});
  }, [id, router]);

  useEffect(() => {
    if (!posts.length) return;
    const likedState = posts.reduce((acc, post) => {
      acc[Number(post.post_id)] = post.is_liked || false;
      return acc;
    }, {} as Record<number, boolean>);
    setLikedPosts(likedState);
  }, [posts]);

  useEffect(() => {
    const checkProfileAccess = async () => {
      if (!currentUserId) {
        setCanViewProfile(false);
        return;
      }
      if (!id || currentUserId === id) {
        setCanViewProfile(true);
        return;
      }
      try {
        const followRes = await fetch(`/api/users/follow-status?following_id=${id}`, {
          credentials: "include",
        });
        if (followRes.ok) {
          const followData = await followRes.json();
          if (isPublic === false && followData.status !== "accepted") {
            setCanViewProfile(false);
          } else {
            setCanViewProfile(true);
          }
        }
      } catch (error) {
        console.error("Error checking profile access:", error);
        setCanViewProfile(false);
      }
    };
    if (id && currentUserId && isPublic !== null) {
      checkProfileAccess();
    }
  }, [id, currentUserId, isPublic, refreshTrigger]);

  const loadUser = async () => {
    try {
      const resUser = await fetch(`/api/users/${currentUserId}/user`, { credentials: "include" });
      if (resUser.ok) {
        const data = await resUser.json();
        setMe(data);
      }
    } catch (error) {
      console.error("Failed to load current user", error);
    }
  };

  useEffect(() => {
    if (currentUserId) loadUser();
  }, [currentUserId]);

  const handleChangeAccountStatus = async () => {
    if (!currentUserId || currentUserId !== id) return;
    try {
      const res = await fetch("/api/users/toggle-privacy", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        const newIsPublic = data.isPublic;
        setIsPublic(newIsPublic);
        setProfile((prev) => (prev ? { ...prev, is_public: newIsPublic } : null));
      } else {
        console.error("Failed to toggle privacy:", res.status);
      }
    } catch (error) {
      console.error("Error toggling privacy:", error);
    }
  };

  const fetchFollowCounts = async () => {
    try {
      const res = await fetch(`/api/users/${id}/follow-counts`);
      if (res.ok) {
        const data = await res.json();
        setFollowerCount(data.follower_count);
        setFollowingCount(data.following_count);
      }
    } catch (error) {
      console.error("Error fetching follow counts:", error);
    }
  };

  const handleFollowUpdate = () => {
    fetchFollowCounts();
    setRefreshTrigger((prev) => prev + 1);
    setRequestRefresh((prev) => prev + 1);
    fetchData();
    if (currentUserId && currentUserId === id) fetchPendingRequestsCount();
  };

  const refreshAccess = () => setRefreshTrigger((prev) => prev + 1);

  useEffect(() => {
    if (id && typeof id === "string") fetchFollowCounts();
  }, [id, refreshTrigger]);

  const fetchPendingRequestsCount = async () => {
    if (!currentUserId || currentUserId !== id) return;
    try {
      const res = await fetch("/api/users/pending-requests", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPendingRequestCount(data.requests?.length || 0);
      }
    } catch (error) {
      console.error("Error fetching pending requests:", error);
    }
  };

  useEffect(() => {
    if (currentUserId && currentUserId === id) fetchPendingRequestsCount();
  }, [currentUserId, id, refreshTrigger, requestRefresh]);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setCurrentUserId(data.id);
          setNickName(data.nickname || "");
        } else {
          router.push("/login");
          return;
        }
      } catch (err) {
        console.error("Error fetching current user:", err);
      }
    };
    fetchCurrentUser();
  }, []);

  // ---------- Comments ----------
  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLSelectElement>) => {
    setCommentForm({ ...CommentForm, [e.target.name]: e.target.value });
  };

  const setCommentImageFile = (file: File | null) => {
    if (previewUrlComment) URL.revokeObjectURL(previewUrlComment);
    if (file) {
      setCommentForm((prev) => ({ ...prev, imageFile: file }));
      setPreviewUrlComment(URL.createObjectURL(file));
    } else {
      setCommentForm((prev) => ({ ...prev, imageFile: null }));
      setPreviewUrlComment(null);
    }
  };

  const submitComment = async (e: React.FormEvent, i: number) => {
    e.preventDefault();
    if (!CommentForm.content.trim()) return;
    const formData = new FormData();
    formData.append("content", CommentForm.content);
    formData.append("post_id", i.toString());
    if (CommentForm.imageFile) formData.append("image", CommentForm.imageFile);

    const res = await fetch("/api/comments", { method: "POST", body: formData, credentials: "include" });
    await res.json();
    if (res.ok) {
      setCommentForm({ postId: i, user_Id: currentUserId, content: "", imageFile: null });
      if (commentFileInputRef.current) commentFileInputRef.current.value = "";
      setCommentImageFile(null);
      fetchComments(i);
    } else {
      console.error("Failed to submit comment");
    }
  };

  const fetchComments = async (i: number) => {
    try {
      const formData = new FormData();
      formData.append("post_id", i.toString());
      const res = await fetch("/api/comments", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch comments");
      const data: Comment[] = await res.json();
      setComments({ [i]: data || [] });
      fetchData();
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const handleDropComment = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveComment(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0] ? e.dataTransfer.files[0] : null;
    if (file && file.type.startsWith("image/")) setCommentImageFile(file);
  };

  const handleCommentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setCommentImageFile(file);
  };

  // ---------- Likes ----------
  const handleLike = async (i: number) => {
    const liked = likedPosts[i];
    setLikedPosts((prev) => ({ ...prev, [i]: !liked }));
    setliked((prev) => ({ ...prev, [i]: (prev[i] || likes[i]) + (liked ? -1 : 1) }));
    try {
      const formData = new FormData();
      formData.append("post_id", i.toString());
      const res = await fetch("/api/likes", { method: "POST", body: formData, credentials: "include" });
      fetchData();
      if (!res.ok) throw new Error("Failed to like post");
    } catch (error) {
      setLikedPosts((prev) => ({ ...prev, [i]: liked }));
      setliked((prev) => ({ ...prev, [i]: (prev[i] || likes[i]) + (liked ? 1 : -1) }));
      console.error("Error liking post:", error);
    }
  };

  // ---------- Profile modal ----------
  const handleProfileClick = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`);
      if (!res.ok) throw new Error("Profile not found");
      const data = await res.json();
      setViewingProfile(data);
    } catch (err) {
      console.error(err);
    }
  };

  // ---------- Data load ----------
  const fetchData = async () => {
    try {
      const profileRes = await fetch(`/api/users/${id}`, {
        credentials: "include"
      });
      if (!profileRes.ok) throw new Error("Profile not found");
      const profileData = await profileRes.json();

      let postsData: Post[] = [];
      try {
        const postsRes = await fetch(`/api/users/${id}/posts`, {
          credentials: "include"
        });
        postsData = postsRes.ok ? await postsRes.json() : [];
        if (!Array.isArray(postsData)) postsData = [];
      } catch (postsError) {
        console.error("Error fetching posts:", postsError);
        postsData = [];
      }

      const profileIsPublic = profileData.is_public;
      setIsPublic(profileIsPublic);
      setProfile({ ...profileData, postCount: postsData.length, is_public: profileIsPublic });
      setPosts(postsData || []);
      setLoading(false);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("An unknown error occurred");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id || typeof id !== "string") return;
    fetchData();
  }, [id, followerCount]);

  useEffect(() => {
    if (!id || !currentUserId) return;
    const intent = localStorage.getItem("intent:openFollowRequests");
    if (intent && String(id) === String(currentUserId)) {
      setShowRequests(true);
      fetchPendingRequestsCount?.();
      localStorage.removeItem("intent:openFollowRequests");
    }
  }, [id, currentUserId]);

  // ---------- Users list for notification name resolution ----------
  useEffect(() => {
    if (!currentUserId) return;
    (async () => {
      try {
        const r = await fetch("/api/users", { credentials: "include" });
        const arr = (await r.json()) || [];
        const cleaned: UserProfileType[] = arr
          .filter((u: any) => u?.id && String(u.id) !== String(currentUserId))
          .map((u: any) => ({
            id: String(u.id),
            firstName: u.firstName ?? u.firstname ?? "",
            last_Name: u.last_Name ?? u.last_name ?? "",
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

  function resolveSenderName(fromId: string, content: any): string {
    const u = usersMapRef.current[String(fromId)];
    const nameFromState =
      u?.nickname ||
      (u?.firstName && u?.lastName ? `${u.firstName} ${u.lastName}` : "") ||
      "";
    const nameFromPayload =
      (content?.nickname ?? [content?.firstName ?? content?.firstName, content?.last_Name ?? content?.lastName].filter(Boolean).join(" "))?.trim() ||
      "";
    return nameFromState || nameFromPayload || `@${fromId}`;
  }

  const goGroupPanel = (groupId?: string) => {
    if (groupId) localStorage.setItem("intent:groupId", String(groupId));
    localStorage.setItem("intent:openGroupPanel", "1");
    router.push("/messages");
  };
  const onGroupEventCreated = (payload: any) => {
    const gTitle = payload?.groupTitle ?? payload?.groupName ?? 'your group';
    const gid = getGroupId(payload);
    toast.success(`📅 New event in ${gTitle}`, {
      onClick: () => goGroupPanel(gid),
      closeOnClick: true,
    });
  };
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
            const mid = n.content?.messageId ? String(n.content.messageId) : "";
            const text = String(n.content?.text ?? "");
            if (!fromId) return;
            if (fromId === String(currentUserId)) return; // ignore own
            const name = resolveSenderName(fromId, n.content);
            toast.info(` ${name}: ${text}`, {
              onClick: () => {
                localStorage.setItem("intent:openDM", fromId);
                router.push("/messages");
              },
            });
          }
if (n.type === 'group_event_created') {
  onGroupEventCreated(n.content || {});
  return;
}
          if (n.type === "follow_request") {
            const followerId = String(n.content?.followerId ?? "");
            const name =
              n.content?.nickname ||
              [n.content?.firstName, n.content?.lastName].filter(Boolean).join(" ") ||
              `@${followerId}`;
            toast.info(` New follow request from ${name}`);
            setRequestRefresh((prev) => prev + 1);
            if (currentUserId === id) fetchPendingRequestsCount();
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
              toast.error(`Follow request declined`);
            }
          }
        }

        if (env.type === "badge.follow_requests") {
          const count = Number(env.data?.count ?? 0);
          setPendingRequestCount(count);
        }

        if (env.type === "group_invite") {
          const gTitle = env.data?.groupTitle ?? env.data?.groupName ?? "a group";
          const gid = getGroupId(env.data);
          toast.info(`Group invite: ${gTitle}`, {
            onClick: () => goGroupPanel(gid),
            closeOnClick: true,
          });
          return;
        }
        if (env.type === "group_event_created") {
          onGroupEventCreated(env.data || env);
          return;
        }

        if (env.type === "group_invite.accepted") {
          const uid = String(env.data?.userId ?? "");
          const name = resolveSenderName(uid, env.data);
          const gid = getGroupId(env.data);
          toast.success(` ${name} accepted your group invite`, {
            onClick: () => goGroupPanel(gid),
            closeOnClick: true,
          });
          return;
        }
        if (env.type === "group_invite.declined") {
          const uid = String(env.data?.userId ?? "");
          const name = resolveSenderName(uid, env.data);
          const gid = getGroupId(env.data);
          toast.error(` ${name} declined your group invite`, {
            onClick: () => goGroupPanel(gid),
            closeOnClick: true,
          });
          return;
        }
        if (env.type === "group_request.created") {
          const whoId = String(env.data?.userId ?? env.data?.requesterId ?? "");
          const who = resolveSenderName(whoId, env.data);
          const g = env.data?.groupTitle ?? "your group";
          const gid = getGroupId(env.data);
          toast.info(`🙋 ${who} requested to join ${g}`, {
            onClick: () => goGroupPanel(gid),
            closeOnClick: true,
          });
          return;
        }
        if (env.type === "group_request.update") {
          const status = String(env.data?.status ?? "").toLowerCase();
          const pretty = status === "accept" ? "accepted 🎉" : status === "decline" ? "declined ❌" : status;
          const g = env.data?.groupTitle ?? "the group";
          const gid = getGroupId(env.data);
          toast(`📢 Your join request was ${pretty} for ${g}`, {
            onClick: () => goGroupPanel(gid),
            closeOnClick: true,
          });
          return;
        }
        if (env.type === "request_to_join_group") {
          const g = env.data?.groupTitle ?? "the group";
          const gid = getGroupId(env.data);
          toast.info(`📨 Request sent to join ${g}`, {
            onClick: () => goGroupPanel(gid),
            closeOnClick: true,
          });
          return;
        }
        if (env.type === "user_left_group") {
          toast(`👋 You left the group`);
          return;
        }
        if (env.type === "group_deleted") {
          toast(`🗑️ Group deleted`);
          return;
        }
      } catch {
        /* ignore parse errors */
      }
    };

    return () => ws.close();
  }, [currentUserId, id]);

  // ---------- UI ----------
  if (loading || isPublic === null) return <div className="bg-black w-[100vw] h-[100vh]">Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!profile) return <div>Profile not found</div>;

  const FollowedLikes: React.FC<{ post: Post }> = ({ post }) => {
    const [showAll, setShowAll] = useState(false);
    const likes = post.following_likes || [];
    if (likes.length === 0) return null;
    const displayNames = () => {
      if (!showAll && likes.length > 2) {
        const remaining = likes.length - 2;
        return (
          <>
            {likes[0]}, {likes[1]} and {remaining} more people you follow liked this post
          </>
        );
      } else if (!showAll && likes.length === 2) {
        return (
          <>
            {likes[0]} and {likes[1]} liked this post
          </>
        );
      } else {
        return likes.join(", ") + " liked this post";
      }
    };
    return (
      <div className="text-sm text-gray-600 cursor-pointer mt-1" onClick={() => likes.length > 2 && setShowAll(!showAll)} title={likes.join(", ")}>
        {displayNames()}
      </div>
    );
  };

  const canSee = canViewProfile || isCurrentUser;

  return canSee ? (
    <>
    <Head>
      <title>{profile.nickname ? `@${profile.nickname}` : `${profile.firstName} ${profile.lastName}`}</title>
    </Head>
    <div className="w-full min-h-screen mx-auto p-4 md:p-8 bg-black flex justify-center items-center">
      {/* Neon BG */}
      <div aria-hidden="true" className="fixed -inset-[50vh] z-0 pointer-events-none blur-[20px] saturate-[1.2] animate-[glowMove_28s_linear_infinite]" style={{
        background:
          `radial-gradient(42rem 42rem at 20% 25%, rgba(0,255,255,0.12), transparent 60%),
           radial-gradient(36rem 36rem at 80% 70%, rgba(255,0,255,0.10), transparent 60%),
           radial-gradient(30rem 30rem at 60% 30%, rgba(0,255,153,0.10), transparent 60%),
           radial-gradient(24rem 24rem at 40% 80%, rgba(0,140,255,0.08), transparent 60%)` }} />

      <Navbar user={me} />

      <div className="w-full flex flex-col gap-8 max-w-6xl relative mt-20 ">
        {/* notification center */}
        {currentUserId === id && (
          <div className="absolute top-0 right-0 z-10 m-5">
            <button onClick={() => setShowRequests(!showRequests)} className="relative p-3 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-colors" title="Follow Requests">
              <Bell className="h-6 w-6 text-white" />
              {pendingRequestCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {pendingRequestCount}
                </span>
              )}
            </button>
            {showRequests && (
              <div className="absolute top-12 right-0 w-80 bg-black/90 backdrop-blur-lg border border-[#8dffe800] rounded-lg shadow-2xl z-20 mt-2">
                <div className="p-4 border-b border-[#8dffe800] ">
                  <h3 className="text-lg font-bold text-white">Follow Requests</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
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
              </div>
            )}
          </div>
        )}

        {/* Info Card */}
        <div className="w-full mx-auto">
          <InfoCard
            avatarUrl={profile.avatar ? (profile.avatar.startsWith("/") ? profile.avatar : `/avatars/${profile.avatar}`) : ""}
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
          <button
  onClick={() => router.push("/profile/edit")}
  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
>
  Edit Profile
</button>

        </div>

        {/* Posts */}
        <div className="w-full rounded-3xl shadow-lg overflow-hidden backdrop-blur-sm border border-[#8dffe800]">
          <div className={`w-full rounded-3xl shadow-lg overflow-hidden backdrop-blur-sm border border-white/10 ${!canViewProfile && currentUserId !== id ? "bg-black/70 backdrop-blur-2xl blur-lg" : ""}`}>
            <div className="p-6 h-full">
              <h2 className="text-xl font-bold text-white mb-3">Posts</h2>
              <div className="space-y-4 h-full">
                {!posts || posts.length === 0 ? (
                  <div className="bg-white/5 rounded-xl p-12 backdrop-blur-sm border border-white/10 min-h-[200px] flex items-center justify-center">
                    <p className="text-white/60">No posts yet</p>
                  </div>
                ) : (
                  posts.map((post, idx) => {
                    const displayName = post.nickname && post.nickname.trim()
                      ? post.nickname
                      : post.firstName && post.lastName
                        ? `${post.firstName} ${post.lastName}`
                        : post.user_id;
                    const initial = displayName.charAt(0)?.toUpperCase() || "?";
                    const imgSrc = post.image ? `/uploads/${post.image}` : null;
                    const cList = comments[Number(post.post_id)] || [];
                    const avatarUrl = post.avatar ? (post.avatar.startsWith("/") ? post.avatar : `/avatars/${post.avatar}`) : null;

                    return (
                      <div key={idx} className="opacity-1 [animation-name:fadeUpScale] [animation-duration:700ms] [animation-timing-function:cubic-bezier(.22,.61,.36,1)] [animation-fill-mode:forwards] will-change-[transform,opacity,filter] bg-[linear-gradient(180deg,#181818,#151515)] p-4 pb-3.5 mb-6 relative overflow-hidden border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-[0_0_8px_rgba(0,255,255,0.15),0_0_18px_rgba(255,0,255,0.12)]" style={{ animationDelay: `${idx * 80}ms` }}>
                        <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ padding: 1.2, background: "conic-gradient(from 90deg, rgba(0,255,255,.6), rgba(255,0,255,.55), rgba(0,255,153,.55), rgba(0,255,255,.6))", backgroundSize: "180% 180%", animation: "borderFlow 10s linear infinite", WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude" }} />

                        {/* header */}
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <div className="flex items-center gap-3">
                            {avatarUrl ? (
                              <img src={avatarUrl} alt={`${displayName} avatar`} className="w-12 h-12 rounded-full object-cover shadow-[0_0_10px_rgba(0,255,255,.25)] border border-[rgba(255,255,255,0.08)]" loading="lazy" decoding="async" />
                            ) : (
                              <div className="grid place-items-center rounded-full font-bold uppercase text-black w-12 h-12 text-[1.1rem] shadow-[0_0_10px_rgba(0,255,255,.25)]" aria-hidden="true" style={{ background: "radial-gradient(circle at 30% 30%, #00ffcc, #66ffff), #00ffcc" }}>
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
                          <span className={[
                            "px-2 py-[0.15rem] rounded-full text-[0.75rem] font-semibold border bg-[#191919] text-[#cfe] tracking-[0.2px]",
                            post.privacy === "public"
                              ? "border-[rgba(0,255,255,.35)]"
                              : post.privacy === "followers"
                                ? "border-[rgba(255,0,255,.35)]"
                                : "border-[rgba(0,255,153,.35)]",
                          ].join(" ")}>{post.privacy}</span>
                        </div>

                        {/* content */}
                        <p className={expanded[idx] ? "" : "overflow-hidden [display:-webkit-box] [-webkit-line-clamp:4] [-webkit-box-orient:vertical] text-[#eaeaea] leading-[1.5] break-words"}>
                          {post.content}
                        </p>
                        {post.content && post.content.length > 500 && (
                          <button className="bg-transparent border-0 text-[#9ad] cursor-pointer p-0 mt-1 font-semibold text-[0.9rem] hover:underline" onClick={() => setExpanded((p) => ({ ...p, [idx]: !p[idx] }))}>
                            {expanded[idx] ? "See less" : "See more"}
                          </button>
                        )}

                        {/* image */}
                        {imgSrc && (
                          <img src={imgSrc} alt="Post" className="w-full rounded-[12px] max-h-[420px] object-cover my-2 shadow-[0_8px_20px_rgba(0,0,0,.35)] transition hover:scale-[1.02] hover:shadow-[0_12px_28px_rgba(0,0,0,.45)] cursor-zoom-in" onClick={() => setLightboxSrc(imgSrc)} />
                        )}

                        {/* actions */}
                        <div className="flex items-center gap-2.5 pt-2 pb-1 px-1">
                          <button type="button" onClick={() => handleLike(Number(post.post_id))} className="inline-flex items-center gap-2 rounded-[10px] bg-[#232323] text-[#eee] border border-[rgba(255,255,255,0.12)] px-3 py-1.5 cursor-pointer font-semibold text-[0.9rem] transition hover:-translate-y-[1px] hover:border-[rgba(0,255,255,.35)] hover:bg-[#2a2a2a]">
                            {likedPosts[Number(post.post_id)] ? "❤️" : "🤍"}
                            {post.like_count ? <span className="opacity-85">{post.like_count}</span> : ""}
                          </button>
                          <button type="button" className="inline-flex items-center gap-2 rounded-[10px] bg-[#232323] text-[#eee] border border-[rgba(255,255,255,0.12)] px-3 py-1.5 cursor-pointer font-semibold text-[0.9rem] transition hover:-translate-y-[1px] hover:border-[rgba(0,255,255,.35)] hover:bg-[#2a2a2a]" onClick={() => {
                            if (!openComments[idx]) fetchComments(Number(post.post_id));
                            setOpenComments((prev) => ({ [idx]: !prev[idx] }));
                          }} aria-expanded={!!openComments[idx]} aria-controls={`comments-${idx}`}>
                            💬 {post.comment_count ? <span className="opacity-85">{post.comment_count}</span> : ""}
                          </button>
                        </div>
                        <FollowedLikes post={post} />

                        {/* comments panel */}
                        {openComments[idx] && (
                          <div id={`comments-${idx}`} className="mt-2.5 p-3 text-white rounded-[12px] bg-[#191919] border border-[rgba(255,255,255,0.08)]">
                            <form onSubmit={(e) => submitComment(e, Number(post.post_id))}>
                              <div className="flex flex-col items-start gap-2">
                                <div className="flex items-center gap-2 w-full">
                                  <textarea value={CommentForm.content} onChange={handleCommentChange} name="content" placeholder="Write a comment" rows={2} required className="flex-1 bg-[#232323] text-white border border-[#444] rounded-[10px] px-3 py-2 resize-none" />
                                  <button type="submit" className="inline-flex items-center gap-2 rounded-[10px] bg-[#232323] text-[#eee] border border-[rgba(255,255,255,0.12)] px-3 py-1.5 cursor-pointer font-semibold text-[0.9rem] transition hover:-translate-y-[1px] hover:border-[rgba(0,255,255,.35)] hover:bg-[#2a2a2a] whitespace-nowrap">Send</button>
                                </div>

                                <div className={["mb-4 border-2 w-full border-dashed rounded-lg p-4 bg-[#151515] transition-colors overflow-hidden", dragActiveComment ? "border-cyan-400 bg-[#111]" : "border-[#555]"].join(" ")} onDragOver={(e) => { e.preventDefault(); setDragActiveComment(true); }} onDragLeave={() => setDragActiveComment(false)} onDrop={handleDropComment}>
                                  <div className="flex justify-between w-full items-center gap-2">
                                    <div className="flex-1">
                                      <div className="font-semibold mb-1">Add an image</div>
                                      <div className="text-sm text-[#888]">Drag & drop, or click “Choose”</div>
                                      {CommentForm.imageFile && (
                                        <div className="text-xs text-[#ccc] mt-1">{CommentForm.imageFile.name}</div>
                                      )}
                                    </div>
                                    <div className="flex gap-2">
                                      <button type="button" className="px-3 py-1.5 text-[0.85rem] rounded-md border-0 cursor-pointer bg-[#0ff] text-black" onClick={() => commentFileInputRef.current?.click()}>Choose</button>
                                      {CommentForm.imageFile && (
                                        <button type="button" className="px-3 py-1.5 text-[0.85rem] rounded-md border-0 cursor-pointer bg-[#232323] text-white" onClick={() => { if (commentFileInputRef.current) commentFileInputRef.current.value = ""; setCommentImageFile(null); }}>Remove</button>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <input ref={commentFileInputRef} type="file" name="image" accept="image/*" className="hidden" onChange={handleCommentFileChange} />

                                {previewUrlComment && (
                                  <img src={previewUrlComment} alt="Preview" className="block max-w-full max-h-[240px] mt-3 rounded-lg object-contain bg-black" />
                                )}
                              </div>
                            </form>

                            {cList.length === 0 ? (
                              <div className="text-[#9aa] text-[0.9rem] mb-2">Be the first to comment.</div>
                            ) : (
                              <div className="grid gap-2 mb-2">
                                {cList.map((c, i) => {
                                  const displayName = c.nickname && c.nickname.trim()
                                    ? c.nickname
                                    : c.firstName && c.lastName
                                      ? `${c.firstName} ${c.lastName}`
                                      : c.user_id;
                                  const initial = displayName.charAt(0)?.toUpperCase() || "?";
                                  const imgSrc = c.image ? `/uploads/${c.image}` : null;
                                  const cAvatar = avatarUrlFor(c.avatar) || null;
                                  return (
                                    <div key={i} className="grid gap-1">
                                      <div className="flex items-center gap-2">
                                        {cAvatar ? (
                                          <img src={cAvatar} alt={`${displayName} avatar`} className="w-[38px] h-[38px] rounded-full object-cover shadow-[0_0_10px_rgba(0,255,255,.25)] border border-[rgba(255,255,255,0.08)]" loading="lazy" decoding="async" onClick={(e) => { e.preventDefault(); handleProfileClick(c.user_id); }} />
                                        ) : (
                                          <div className="grid place-items-center rounded-full font-bold uppercase text-black w-[38px] h-[38px] text-[0.95rem] shadow-[0_0_10px_rgba(0,255,255,.25)]" aria-hidden="true" style={{ background: "radial-gradient(circle at 30% 30%, #00ffcc, #66ffff), #00ffcc" }} onClick={(e) => { e.preventDefault(); handleProfileClick(c.user_id); }}>
                                            {initial}
                                          </div>
                                        )}
                                        <div className="font-bold" onClick={(e) => { e.preventDefault(); handleProfileClick(c.user_id); }}>
                                          {displayName}
                                        </div>
                                        <div className="text-[#9aa] text-[0.8rem]">{relTime(c.created_at)}</div>
                                      </div>
                                      <div className="ml-[2.3rem] text-[#ddd] leading-[1.35] break-words [overflow-wrap:anywhere]">{c.text}</div>
                                      {imgSrc && (
                                        <img src={imgSrc} alt="Post" className="w-full rounded-[12px] max-h-[210px] object-cover my-2 shadow-[0_8px_20px_rgba(0,0,0,.35)] transition hover:scale-[1.02] hover:shadow-[0_12px_28px_rgba(0,0,0,.45)] cursor-zoom-in" onClick={() => setLightboxSrc(imgSrc)} />
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
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div className="fixed inset-0 z-[2000] bg-[rgba(0,0,0,.75)] grid place-items-center p-8 backdrop-blur-[4px]" onClick={() => setLightboxSrc(null)}>
          <button className="fixed top-[18px] right-[24px] text-white text-[1.4rem] bg-transparent border-0 cursor-pointer" aria-label="Close">✕</button>
          <img className="max-w-[92vw] max-h-[86vh] rounded-[12px] border border-[rgba(255,255,255,.15)] shadow-[0_30px_80px_rgba(0,0,0,.65),0_0_40px_rgba(0,255,255,.18)]" src={lightboxSrc} alt="Preview" />
        </div>
      )}

      {/* Inline profile viewer */}
      {ViewingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/70" onClick={() => setViewingProfile(null)}>
          <div className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <button className="absolute -top-10 -right-7 text-white hover:trxt-gray-300 text-2xl transition-colors" onClick={() => setViewingProfile(null)}>✕</button>
            {(() => {
              const normalizedUser = ViewingProfile
                ? {
                  id: ViewingProfile.id,
                  name: `${ViewingProfile.firstName} ${ViewingProfile.lastName}`,
                  firstName: ViewingProfile.firstName,
                  lastName: ViewingProfile.lastName,
                  nickname: ViewingProfile.nickname,
                  avatar: ViewingProfile.avatar,
                  online: (ViewingProfile as any).online,
                  isPublic: (ViewingProfile as any).isPublic,
                }
                : null;
              return (
                <ProfileCard
                  user={normalizedUser}
                  avatarUrl={ViewingProfile.avatar ? (ViewingProfile.avatar.startsWith("/") ? ViewingProfile.avatar : `/avatars/${ViewingProfile.avatar}`) : "/avatars/avatar.jpeg"}
                  name={`${ViewingProfile.firstName} ${ViewingProfile.lastName}`}
                  nickname={ViewingProfile.nickname}
                  userId={ViewingProfile.id}
                  onContactClick={() => { }}
                />
              );
            })()}
          </div>
        </div>
      )}

      <ToastContainer position="bottom-left" autoClose={4000} hideProgressBar={false} newestOnTop closeOnClick pauseOnFocusLoss draggable pauseOnHover theme="dark" />
    </div>
  </>) : (
    <div className="w-full min-h-screen mx-auto p-4 md:p-8 bg-black flex justify-center items-center">
      {/* Neon BG */}
      <div aria-hidden="true" className="fixed -inset-[50vh] z-0 pointer-events-none blur-[20px] saturate-[1.2] animate-[glowMove_28s_linear_infinite]" style={{
        background:
          `radial-gradient(42rem 42rem at 20% 25%, rgba(0,255,255,0.12), transparent 60%),
           radial-gradient(36rem 36rem at 80% 70%, rgba(255,0,255,0.10), transparent 60%),
           radial-gradient(30rem 30rem at 60% 30%, rgba(0,255,153,0.10), transparent 60%),
           radial-gradient(24rem 24rem at 40% 80%, rgba(0,140,255,0.08), transparent 60%)` }} />
      <Navbar user={me} />
      <div className="w-full mx-auto">
        <InfoCard
          avatarUrl={profile.avatar ? (profile.avatar.startsWith("/") ? profile.avatar : `/avatars/${profile.avatar}`) : ""}  // ← let fallback render
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
      <ToastContainer position="bottom-left" autoClose={4000} hideProgressBar={false} newestOnTop closeOnClick pauseOnFocusLoss draggable pauseOnHover theme="dark" />
    </div>
  );
}
