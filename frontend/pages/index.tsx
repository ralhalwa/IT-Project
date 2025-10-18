"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import ProfileCard from "@/components/profile/ProfileCard";
import Navbar from "@/components/ui/navbar";
import { User, UserProfile } from "@/types/user";
import { toast, ToastContainer } from 'react-toastify';
import { Plus, X } from "lucide-react";
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

type Relationship = {
  iFollow: boolean;
  followsMe: boolean;
};
export default function HomePage() {
  const router = useRouter();
  const [relationships, setRelationships] = useState<
    Record<string, Relationship>
  >({});
  const rels: Record<string, Relationship> = {};
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentNickname, setCurrentNickname] = useState<string>("");
  const [ViewingProfile, setViewingProfile] = useState<UserProfile | null>(
    null
  );
  const [me, setMe] = useState<User | null>(null);

  const validateImageFile = (file: File): string | null => {
  // Check file size (25MB max)
  if (file.size > 25 * 1024 * 1024) {
    return 'File size too large - maximum 25MB';
  }

  // Check file extension
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
  const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  
  if (!allowedExtensions.includes(fileExtension)) {
    return 'Invalid file type. Only JPG, PNG, and GIF are allowed';
  }

  // Check MIME type
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (!allowedMimeTypes.includes(file.type)) {
    return 'Invalid file format. Only JPEG, PNG, and GIF images are allowed';
  }

  return null;
};

  const loadMe = async () => {
    try {
      const res = await fetch("/api/me", {
        credentials: "include",
      });

      if (!res.ok) {
        router.push("/login");
        return;
      }

      const data = await res.json();
      if (!data?.id) {
        router.push("/login");
        return;
      }

      setCurrentUserId(data.id || "");
      setCurrentNickname(data.nickname || "");
      setForm((prev) => ({ ...prev, user_id: data.id }));
      await fetchUsers();
      await relationshipsFetch(), await fetchPosts();
    } catch (e) {
      console.error("Failed to load current user", e);
      router.push("/login");
    }
  };

  const loadUser = async () => {
    try {
      const resUser = await fetch(`/api/users/${currentUserId}/user`, {
        credentials: "include",
      });

      if (resUser.ok) {
        const data = await resUser.json();
        setMe(data);
      }
    } catch (error) {
      console.error("Failed to load current user", error);
    }
  };
  const getGroupId = (obj: any) =>
    String(obj?.groupId ?? obj?.groupID ?? obj?.group_id ?? "");
  const handleProfileClick = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`);
      if (!res.ok) console.error("Profile not found");
      const data = await res.json();
      setViewingProfile(data);
    } catch (err) {
      setMessage("Failed to load profile");
      console.error(err);
    }
  };
  const avatarUrlFor = (avatar?: string) =>
    avatar ? (avatar.startsWith("/") ? avatar : `/avatars/${avatar}`) : null;
  const [form, setForm] = useState({
    user_id: "",
    content: "",
    imageFile: null as File | null,
    privacy: "public" as "public" | "followers" | "custom",
  });
  const [CommentForm, setCommentForm] = useState({
    postId: 0,
    user_Id: currentUserId,
    content: "",
    imageFile: null as File | null,
  });
  const [customUsers, setCustomUsers] = useState<string[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [relUsers, setRelUsers] = useState<UserProfile[]>([]);
  const [message, setMessage] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const commentFileInputRef = useRef<HTMLInputElement | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [pendingFollowReqs, setPendingFollowReqs] = useState(0);

  // image drag & preview
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // image drag & preview
  const [dragActiveComment, setDragActiveComment] = useState(false);
  const [previewUrlComment, setPreviewUrlComment] = useState<string | null>(
    null
  );

  // post UI helpers
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  // comments UI (local only)
  const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
  const [comments, setComments] = useState<Record<number, Comment[]>>({});
  const [likes, setliked] = useState<Record<number, number>>({});
  const [likedPosts, setLikedPosts] = useState<Record<number, boolean>>({});

  // ---- FILTER STATE ----
  const [q, setQ] = useState("");
  const [privacyFilter, setPrivacyFilter] = useState<
    "all" | "public" | "followers" | "custom"
  >("all");
  const [sortOrder, setSortOrder] = useState<"new" | "old">("new");
  const [hasImageOnly, setHasImageOnly] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const isComposingEvent = (e: React.KeyboardEvent) =>
    (e.nativeEvent as any).isComposing || (e as any).keyCode === 229;
  const onEnterSubmit =
    (submitFn: () => void) =>
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (isComposingEvent(e)) return; // IME safety
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault(); // stop newline
          submitFn();
        }
      };

  const submitPost = async () => {
    const formData = new FormData();
    formData.append("content", form.content);
    formData.append("privacy", form.privacy);
    if (form.imageFile) formData.append("image", form.imageFile);
    if (form.privacy === "custom") {
      for (const userId of customUsers) formData.append("custom_users[]", userId);
    }

    const res = await fetch("/api/posts", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    await res.json();
    if (res.ok) {
      setMessage("Post created successfully.");
      setForm({
        user_id: currentUserId,
        content: "",
        imageFile: null,
        privacy: "public",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      setImageFile(null);
      fetchPosts();
      setShowForm(false);
    } else {
      setMessage("Failed to create post.");
    }
  };

  const submitCommentQuick = async (postNumericId: number) => {
    if (!CommentForm.content.trim() && !CommentForm.imageFile) {
      setMessage("Comment cannot be empty.");
      return;
    }
    const formData = new FormData();
    formData.append("content", CommentForm.content);
    formData.append("post_id", String(postNumericId));
    if (CommentForm.imageFile) formData.append("image", CommentForm.imageFile);

    const res = await fetch("/api/comments", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    await res.json();
    if (res.ok) {
      setMessage("Comment created successfully.");
      setCommentForm({
        postId: postNumericId,
        user_Id: currentUserId,
        content: "",
        imageFile: null,
      });
      if (commentFileInputRef.current) commentFileInputRef.current.value = "";
      setCommentImageFile(null);
      fetchComments(postNumericId);
    } else {
      setMessage("Failed to create Comment.");
    }
  };


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

  useEffect(() => {
    if (message) {
      const timeout = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(timeout);
    }
  }, [message]);

  const handleChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCommentChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setCommentForm({ ...CommentForm, [e.target.name]: e.target.value });
  };

  const setImageFile = (file: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (file) {
      setForm((prev) => ({ ...prev, imageFile: file }));
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setForm((prev) => ({ ...prev, imageFile: null }));
      setPreviewUrl(null);
    }
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

  const FollowedLikes: React.FC<{ post: Post }> = ({ post }) => {
    const [expanded, setExpanded] = useState(false);

    const likes = post.following_likes || [];
    if (likes.length === 0) return null;

    const displayNames = () => {
      if (!expanded && likes.length > 2) {
        const remaining = likes.length - 2;
        return (
          <>
            {likes[0]}, {likes[1]} and {remaining} more people you follow liked
            this post
          </>
        );
      } else if (!expanded && likes.length == 2) {
        return (
          <>
            {likes[0]} and {likes[1]} liked this post
          </>
        );
      } else {
        return likes.join(", ") + " liked this post";
      }
    };

    const handleClick = () => {
      if (likes.length > 2) setExpanded(!expanded);
    };

    return (
      <div
        className="text-sm text-gray-600 cursor-pointer mt-1"
        onClick={handleClick}
        title={likes.join(", ")}
      >
        {displayNames()}
      </div>
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;

    if (file) {
    const error = validateImageFile(file);
    if (error) {
      setMessage(error);
      e.target.value = '';
      return;
    }
  }
    setImageFile(file);
  };

  const handleCommentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;

    if (file) {
    const error = validateImageFile(file);
    if (error) {
      setMessage(error);
      e.target.value = ''; 
      return;
    }
  }

    setCommentImageFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file =
      e.dataTransfer.files && e.dataTransfer.files[0]
        ? e.dataTransfer.files[0]
        : null;
      
     if (file) {
    
    if (!file.type.startsWith("image/")) {
      setMessage('Only image files are allowed');
      return;
    }
    
    const error = validateImageFile(file);
    if (error) {
      setMessage(error);
      return;
    }
  }
  
  setImageFile(file);
  };

  const handleDropComment = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveComment(false);
    const file =
      e.dataTransfer.files && e.dataTransfer.files[0]
        ? e.dataTransfer.files[0]
        : null;
    
  if (file) {
    if (!file.type.startsWith("image/")) {
      setMessage('Only image files are allowed');
      return;
    }
    
    const error = validateImageFile(file);
    if (error) {
      setMessage(error);
      return;
    }
  }
  
  setCommentImageFile(file);
  };

  const toggleCustomUser = (id: string) => {
    setCustomUsers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleLike = async (i: number) => {
    const liked = likedPosts[i];
    setLikedPosts((prev) => ({ ...prev, [i]: !liked }));
    setliked((prev) => ({
      ...prev,
      [i]: (prev[i] || likes[i]) + (liked ? -1 : 1),
    }));
    try {
      const formData = new FormData();
      formData.append("post_id", i.toString());
      const res = await fetch("/api/likes", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      fetchPosts();
      if (!res.ok) console.error("Failed to like post");
    } catch (error) {
      setLikedPosts((prev) => ({ ...prev, [i]: liked }));
      setliked((prev) => ({
        ...prev,
        [i]: (prev[i] || likes[i]) + (liked ? 1 : -1),
      }));
      console.error("Error liking post:", error);
      setMessage("Failed to like post.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("content", form.content);
    formData.append("privacy", form.privacy);
    if (form.imageFile) formData.append("image", form.imageFile);
    if (form.privacy === "custom") {
      for (const userId of customUsers)
        formData.append("custom_users[]", userId);
    }

    const res = await fetch("/api/posts", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    await res.json();
    if (res.ok) {
      setMessage("Post created successfully.");
      setForm({
        user_id: currentUserId,
        content: "",
        imageFile: null,
        privacy: "public",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      setImageFile(null);
      fetchPosts();
      setShowForm(false);
    } else {
      setMessage("Failed to create post.");
    }
  };

  const submitComment = async (e: React.FormEvent, i: number) => {
    e.preventDefault();
    if (!CommentForm.content.trim()) {
      setMessage("Comment cannot be empty.");
      return;
    }
    const formData = new FormData();
    formData.append("content", CommentForm.content);
    formData.append("post_id", i.toString());
    if (CommentForm.imageFile) formData.append("image", CommentForm.imageFile);

    const res = await fetch("/api/comments", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    await res.json();
    if (res.ok) {
      setMessage("Comment created successfully.");
      setCommentForm({
        postId: i,
        user_Id: currentUserId,
        content: "",
        imageFile: null,
      });
      if (commentFileInputRef.current) commentFileInputRef.current.value = "";
      setCommentImageFile(null);
      fetchComments(i);
    } else {
      setMessage("Failed to create Comment.");
    }
  };

  const fetchPosts = async () => {
    try {
      const res = await fetch("/api/posts", {
        credentials: "include",
      });
      if (!res.ok) console.error("Failed to fetch posts");
      const data: Post[] = await res.json();
      setPosts(data || []);
    } catch (error) {
      console.error("Error fetching posts:", error);
      setMessage("Unable to fetch posts. Backend might be down.");
    }
  };

  const fetchComments = async (i: number) => {
    try {
      const formData = new FormData();
      formData.append("post_id", i.toString());
      const res = await fetch("/api/comments", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) console.error("Error fetching comments:");
      const data: Comment[] = await res.json();
      console.log("Fetched comments for post", i, data);
      setComments({ [i]: data || [] });
      fetchPosts();
    } catch (error) {
      console.error("Error fetching comments:", error);
      setMessage("Unable to fetch posts. Backend might be down.");
    }
  };
  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      const filtered = data
        .filter((u: any) => u.id !== currentUserId)
        .map(
          (u: any): UserProfile => ({
            id: String(u.id),
            firstName: u.firstName ?? u.firstName ?? "",
            lastName: u.lastName ?? u.lastName ?? "",
            nickname: u.nickname ?? "",
            email: u.email ?? "",
            dob: u.dob ?? "",
            aboutMe: u.about_me ?? u.aboutMe ?? "",
            avatar: u.avatar ?? "", // keep raw; we'll fix the URL with avatarUrlFor()
            isPublic: !!u.is_public,
          })
        );
      setUsers(filtered);
    } catch (error) {
      console.error("Failed to load users", error);
    }
  };
  const relationshipsFetch = async () => {
    try {
      const rel = await fetch('/api/relationshipsForPost', {
        credentials: "include",
      });
      if (rel.ok) {
        const data = await rel.json();
        const map = data?.relationshipsForPost ?? data?.relationships ?? {};
        setRelationships(map as Record<string, Relationship>);
      } else {
        console.warn("relationshipsFetch non-OK", rel.status);
      }
    } catch (error) {
      console.error(error);
    }
  };
  const getRelatedUsers = (userId: string): UserProfile[] => {
    return users.filter(u => {
      const rel = relationships[u.id];
      // If the user is the one we're checking, skip
      if (u.id === userId) return false;
      // If the userId follows u, or u follows userId
      return rel?.iFollow || rel?.followsMe;
    });
  };
  const relFor = (uid?: string): Relationship | null =>
    uid ? relationships[uid] || null : null;

  useEffect(() => {
    loadMe();

    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadUser();
    }
  }, [currentUserId]);

  const filteredPosts = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = posts.slice();

    if (privacyFilter !== "all") {
      list = list.filter((p) => p.privacy === privacyFilter);
    }

    if (hasImageOnly) {
      list = list.filter((p) => !!p.image);
    }

    if (mineOnly) {
      list = list.filter((p) => p.user_id === currentUserId);
    }

    if (query) {
      list = list.filter(
        (p) =>
          p.content.toLowerCase().includes(query) ||
          p.user_id.toLowerCase().includes(query) ||
          (p.nickname || "").toLowerCase().includes(query)
      );
    }

    list.sort((a, b) =>
      sortOrder === "new"
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return list;
  }, [
    posts,
    q,
    privacyFilter,
    hasImageOnly,
    mineOnly,
    sortOrder,
    form.user_id,
  ]);
  const usersById = useMemo(() => {
    const map: Record<string, { avatar?: string }> = {};
    for (const u of users) map[u.id] = { avatar: u.avatar };
    return map;
  }, [users]);

  useEffect(() => {
    if (!posts.length) return;

    const likedState = posts.reduce(
      (acc, post) => {
        acc[Number(post.post_id)] = post.is_liked || false;
        return acc;
      },
      {} as Record<number, boolean>
    );

    setLikedPosts(likedState);
  }, [posts]);

  const nameForUserId = (id: string) => {
    const u = users.find(u => String(u.id) === String(id));
    return u?.nickname
      || (u?.firstName && u?.lastName ? `${u.firstName} ${u.lastName}` : '')
      || 'Unknown';
  };

  // mark a DM notification as read by message id
  const markReadByMessage = (messageId: string) => {
    if (!messageId) return;
    fetch('/api/notifications/read-by-message', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId }),
    }).catch(() => { });
  };
  function resolveSenderName(fromId: string, content: any): string {
    const u = users.find(u => String(u.id) === String(fromId));

    const nameFromState =
      u?.nickname ||
      (u?.firstName && u?.lastName ? `${u.firstName} ${u.lastName}` : '') ||
      '';

    const nameFromPayload =
      (content?.nickname ??
        [content?.firstName, content?.lastName].filter(Boolean).join(' '))
        ?.trim() || '';

    return nameFromState || nameFromPayload || `@${fromId}`;
  }
  const goGroupPanel = (groupId?: string) => {
    if (groupId) localStorage.setItem("intent:groupId", String(groupId));
    localStorage.setItem("intent:openGroupPanel", "1");
    router.push("/messages");
  };
  const goGroupEvent = (groupId?: string) => {
    if (groupId) localStorage.setItem("intent:groupId", String(groupId));
    localStorage.setItem("intent:openGroupEvents", "1");
    router.push("/messages");
  };

  const onGroupEventCreated = (payload: any) => {
    const gTitle = payload?.groupTitle ?? payload?.groupName ?? 'your group';
    const gid = String(payload?.groupId ?? payload?.groupID ?? payload?.group_id ?? '');
    const title = payload?.eventTitle ?? payload?.title ?? 'New event';
    toast.success(`📅 New event ${title} in ${gTitle}`, {
      onClick: () => goGroupEvent(gid),
      closeOnClick: true,
    });

  };
  
  useEffect(() => {
    if (!currentUserId) return;

    const hostname = window.location.hostname;
    const ws = new WebSocket(`ws://${hostname}:8080/ws`);

    ws.onmessage = (ev: MessageEvent) => {
      try {
        const env = JSON.parse(ev.data);

        if (env.type === 'notification.created') {
          const n = env.data as { id: number; type: string; content: any };

          if (n.type === 'dm') {
            const fromId = String(n.content?.from ?? '');
            const mid = n.content?.messageId ? String(n.content.messageId) : '';
            const text = String(n.content?.text ?? '');

            if (!fromId) return;

            if (fromId === String(currentUserId)) {
              if (mid) markReadByMessage(mid);
              return;
            }

            const name = nameForUserId(fromId);
            toast.info(`💬 ${name}: ${text}`, {
              onClick: () => {
                localStorage.setItem('intent:openDM', fromId);
                router.push('/messages');
              },
            });
          }

          if (env.type === "group_invite") {
            const gTitle = env.data?.groupTitle ?? env.data?.groupName ?? "a group";
            const gid = getGroupId(env.data);
            toast.info(`📨 Group invite: ${gTitle}`, {
              onClick: () => goGroupPanel(gid), // ← open panel on click
              closeOnClick: true,
            });
            return;
          }


          // if (n.type === 'group_event_created') {
          //   toast.success(`📅 New event in ${n.content?.groupTitle || 'your group'}`);
          // }
          // 🔔 someone requested to follow me (sent to the account owner)
          if (n.type === 'follow_request') {
            const followerId = String(n.content?.followerId ?? '');
            const name =
              resolveSenderName?.(followerId, n.content) // if you added this helper earlier
              || nameForUserId(followerId);              // fallback to your existing helper

            toast.info(`🔔 New follow request from ${name}`, {
              onClick: () => {
                localStorage.setItem('intent:openFollowRequests', '1');
                router.push(`/profile/${currentUserId}`);
              },
            });
          }


          if (n.type === 'follow_request.update') {
            const status = String(n.content?.status ?? '');
            const followingId = String(n.content?.followingId ?? '');

            if (status === 'accepted') {
              toast.success('✅ Follow request accepted');
              // instantly unlock “iFollow” in local state so DM/feed rules update without refresh
              setRelationships(prev => ({
                ...prev,
                [followingId]: { ...(prev[followingId] || {}), iFollow: true },
              }));
              // relationshipsFetch();
            } else if (status === 'declined') {
              toast(`❌ Follow request declined`);
              // optional local reflect
              setRelationships(prev => ({
                ...prev,
                [followingId]: { ...(prev[followingId] || {}), iFollow: false },
              }));
            }
          }
          if (n.type === 'group_event_created') {
            onGroupEventCreated(n.content || {});
            return;
          }

        }
        if (env.type === "group_invite") {
          const gTitle = env.data?.groupTitle ?? env.data?.groupName ?? "a group";
          const gid = getGroupId(env.data);
          toast.info(`📨 Group invite: ${gTitle}`, {
            onClick: () => goGroupPanel(gid),
            closeOnClick: true,
          });
          return;
        }


        if (env.type === 'group_event_created') {
          onGroupEventCreated(env.data || env);
          return;
        }

        if (env.type === "group_invite.accepted") {
          const uid = String(env.data?.userId ?? "");
          const name = resolveSenderName(uid, env.data);
          const gid = getGroupId(env.data);
          toast.success(`✅ ${name} accepted your group invite`, {
            onClick: () => goGroupPanel(gid),
            closeOnClick: true,
          });
          return;
        }

        if (env.type === "group_invite.declined") {
          const uid = String(env.data?.userId ?? "");
          const name = resolveSenderName(uid, env.data);
          const gid = getGroupId(env.data);
          toast.error(`❌ ${name} declined your group invite`, {
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
          const status = String(env.data?.status ?? "").toLowerCase(); // 'accept' | 'decline'
          const pretty = status === "accept" ? "accepted 🎉" : status === "decline" ? "declined ❌" : status;
          const g = env.data?.groupTitle ?? "the group";
          const gid = getGroupId(env.data);
          toast(`📢 Your join request was ${pretty} for ${g}`, {
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
        if (env.type === 'badge.unread') {
          const count = Number(env.data?.count ?? 0);
        }
        if (env.type === 'badge.follow_requests') {
          const count = Number(env.data?.count ?? 0);
          setPendingFollowReqs(count);
        }

      } catch {
      }
    };

    return () => ws.close();
  }, [currentUserId, users]);
  const anyFilterActive =
    !!q ||
    privacyFilter !== "all" ||
    hasImageOnly ||
    mineOnly ||
    sortOrder !== "new";
  const activeCount = [
    !!q,
    privacyFilter !== "all",
    hasImageOnly,
    mineOnly,
    sortOrder !== "new",
  ].filter(Boolean).length;
  if (currentUserId === "") {
    return (
      <div className="m-0 p-0 bg-[#0a0a0a] text-white overflow-x-hidden min-h-full relative">
        {/* Neon animated background */}
        <div
          aria-hidden="true"
          className="fixed -inset-[50vh] z-0 pointer-events-none blur-[20px] saturate-[1.2] animate-[glowMove_28s_linear_infinite]"
          style={{
            background: `
            radial-gradient(42rem 42rem at 20% 25%, rgba(0,255,255,0.12), transparent 60%),
            radial-gradient(36rem 36rem at 80% 70%, rgba(255,0,255,0.10), transparent 60%),
            radial-gradient(30rem 30rem at 60% 30%, rgba(0,255,153,0.10), transparent 60%),
            radial-gradient(24rem 24rem at 40% 80%, rgba(0,140,255,0.08), transparent 60%)
          `,
          }}
        />
      </div>
    );
  } else {
    return (<>
    <Head>
      <title>Home</title>
    </Head>
      <div className="m-0 p-0 bg-[#0a0a0a] text-white overflow-x-hidden min-h-full relative">
        {/* Neon animated background */}
        <div
          aria-hidden="true"
          className="fixed -inset-[50vh] z-0 pointer-events-none blur-[20px] saturate-[1.2] animate-[glowMove_28s_linear_infinite]"
          style={{
            background: `
            radial-gradient(42rem 42rem at 20% 25%, rgba(0,255,255,0.12), transparent 60%),
            radial-gradient(36rem 36rem at 80% 70%, rgba(255,0,255,0.10), transparent 60%),
            radial-gradient(30rem 30rem at 60% 30%, rgba(0,255,153,0.10), transparent 60%),
            radial-gradient(24rem 24rem at 40% 80%, rgba(0,140,255,0.08), transparent 60%)
          `,
          }}
        />

        <div className="relative min-h-[100vh] z-[1]">
          {/* Navbar */}
          <Navbar user={me} />

          {/* Floating Button */}
          <button
            className="fixed flex justify-center items-center bottom-[30px] right-[30px] w-[40px] h-[40px] rounded-full text-white text-[2rem] backdrop-blur-[10px] cursor-pointer z-[1001] border border-blue-400"
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-5 h-5" />
          </button>

          {/* Modal */}
          {showForm && (
            <div className="fixed inset-0 bg-[rgba(0,0,0,0.4)] backdrop-blur-[12px] saturate-[180%] grid place-items-center p-6 overflow-y-auto z-[1000]">
              <div className="relative bg-[#1e1e1e] px-6 py-8 rounded-[12px] w-[92vw] max-w-[600px] border border-[rgba(255,255,255,0.1)] overflow-visible">
                {/* neon border */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-[12px]"
                  style={{
                    padding: 1,
                    background:
                      "linear-gradient(270deg, #00ffff, #ff00ff, #00ff99, #00ffff)",
                    backgroundSize: "300% 300%",
                    animation: "borderFlow 8s ease infinite",
                    WebkitMask:
                      "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                    WebkitMaskComposite: "xor",
                    maskComposite: "exclude",
                  }}
                />
                <button
                  className="absolute top-2.5 right-4 bg-transparent text-white text-[1.2rem] border-0 cursor-pointer"
                  onClick={() => setShowForm(false)}
                >
                  <X className="w-5 h-5 mt-2" />
                </button>

                <div className="max-h-[calc(100vh-48px)] overflow-auto pr-[2px] pt-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitPost();
                    }}
                  >
                    <textarea
                      name="content"
                      value={form.content}
                      onChange={handleChange}
                      onKeyDown={onEnterSubmit(submitPost)}
                      placeholder="Write your post..."
                      required
                      maxLength={150}
                      rows={4}
                      className="w-full p-3 rounded-md border border-[#444] bg-[#2a2a2a] text-white mb-2 resize-none"
                    />
                    <div className="text-[12px] text-[#9aa] mb-2">
                      Press <b>Enter</b> to send · <b>Shift+Enter</b> for new line
                    </div>


                    {/* Themed file upload */}
                    <div
                      className={[
                        "mb-4 border-2 border-dashed rounded-lg p-4 bg-[#151515] transition-colors overflow-hidden",
                        dragActive
                          ? "border-cyan-400 bg-[#111]"
                          : "border-[#555]",
                      ].join(" ")}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragActive(true);
                      }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={handleDrop}
                    >
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex-1">
                          <div className="font-semibold mb-1">Add an image</div>
                          <div className="text-sm text-[#888]">
                            Drag & drop, or click “Choose”
                          </div>
                          {form.imageFile && (
                            <div className="text-xs text-[#ccc] mt-1">
                              {form.imageFile.name}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="px-3 py-1.5 text-[0.85rem] rounded-md border-0 cursor-pointer bg-[#0ff] text-black"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            Choose
                          </button>
                          {form.imageFile && (
                            <button
                              type="button"
                              className="px-3 py-1.5 text-[0.85rem] rounded-md border-0 cursor-pointer bg-[#232323] text-white"
                              onClick={() => {
                                if (fileInputRef.current)
                                  fileInputRef.current.value = "";
                                setImageFile(null);
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        name="image"
                        accept=".jpg,.jpeg,.png,.gif,image/jpeg,image/png,image/gif"
                        className="hidden"
                        onChange={handleFileChange}
                      />

                      {previewUrl && (
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="block max-w-full max-h-[240px] mt-3 rounded-lg object-contain bg-black"
                        />
                      )}
                    </div>

                    {/* Themed select + fixed arrow */}
                    <div className="relative mb-5">
                      <select
                        name="privacy"
                        value={form.privacy}
                        onChange={handleChange}
                        className={[
                          "w-full rounded-[10px] bg-[#2a2a2a] text-white border border-[#444] font-medium",
                          "px-3 py-2 pr-10 transition focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_0_3px_rgba(0,255,255,.15)]",
                          form.privacy === "public"
                            ? "border-[rgba(0,255,255,.5)]"
                            : form.privacy === "followers"
                              ? "border-[rgba(255,0,255,.5)]"
                              : "border-[rgba(0,255,153,.5)]",
                        ].join(" ")}
                      >
                        <option value="public">Public</option>
                        <option value="followers">Followers</option>
                        <option value="custom">Custom</option>
                      </select>
                      <div className="mt-1 text-xs text-[#9aa]">
                        {form.privacy === "public" && "Visible to everyone."}
                        {form.privacy === "followers" &&
                          "Only visible to followers."}
                        {form.privacy === "custom" &&
                          "Only visible to selected users."}
                      </div>
                    </div>

                    {form.privacy === "custom" && (
                      <div className="mt-2 border border-[#333] bg-[rgba(255,255,255,0.04)] rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-dashed border-[rgba(255,255,255,0.08)]">
                          <label className="font-semibold">
                            Select users who can view this post
                          </label>
                          <small className="text-[#9ad]">
                            {customUsers.length} selected
                          </small>
                        </div>

                        <div className="grid grid-cols-1 gap-2 pr-1 mt-4 max-h-[220px] overflow-auto sm:grid-cols-2">
                          {getRelatedUsers(currentUserId).map((u) => {
                            const checked = customUsers.includes(u.id);

                            // nickname -> First Last -> id
                            const displayName =
                              u.nickname && u.nickname.trim()
                                ? u.nickname
                                : u.firstName && u.lastName
                                  ? `${u.firstName} ${u.lastName}`
                                  : u.id;

                            const initial = (displayName || u.id || "?")
                              .charAt(0)
                              .toUpperCase();
                            const inputId = `chk-${u.id}`;
                            const avatarUrl = u.avatar
                              ? u.avatar.startsWith("/")
                                ? u.avatar
                                : `/avatars/${u.avatar}`
                              : null;

                            return (
                              <label
                                key={u.id}
                                htmlFor={inputId}
                                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2.5 rounded-[10px] bg-[#191919] border border-[rgba(255,255,255,0.08)] transition hover:border-[rgba(0,255,255,0.35)] hover:bg-[#1c1c1c]"
                              >
                                {avatarUrl ? (
                                  <img
                                    src={avatarUrl}
                                    alt={`${displayName} avatar`}
                                    className="w-[38px] h-[38px] rounded-full object-cover shadow-[0_0_10px_rgba(0,255,255,.25)] border border-[rgba(255,255,255,0.08)]"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                ) : (
                                  <div
                                    className="grid place-items-center rounded-full font-bold uppercase text-black w-[38px] h-[38px] text-[0.95rem] shadow-[0_0_10px_rgba(0,255,255,.25)]"
                                    aria-hidden="true"
                                    style={{
                                      background:
                                        "radial-gradient(circle at 30% 30%, #00ffcc, #66ffff), #00ffcc",
                                    }}
                                  >
                                    {initial}
                                  </div>
                                )}
                                <div className="leading-[1.1]">
                                  <div className="text-white font-semibold text-[0.95rem]">
                                    {displayName}
                                  </div>
                                </div>
                                <div>
                                  <input
                                    id={inputId}
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleCustomUser(u.id)}
                                    className="w-[18px] h-[18px] cursor-pointer accent-cyan-400"
                                  />
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="bg-[rgb(61,57,57)] text-white px-6 py-2.5 rounded-md cursor-pointer w-full font-medium mt-4"
                    >
                      Post
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          <br />
          <br />

          {/* ========= FILTER PILL BAR ========= */}
          <section
            aria-label="Filters"
            className="max-w-[780px] mx-auto mt-24 px-4 sticky top-[72px] z-[5]"
          >
            {/* Search */}
            <div className="flex items-center justify-center mb-4">
              <div className="inline-flex items-center gap-[0.55rem] px-[0.8rem] py-[0.52rem] rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.12)] text-[#e9f9ff] backdrop-blur-[6px] shadow-[inset_0_0_0_1px_rgba(0,255,255,.06)] transition hover:border-[rgba(0,255,255,.35)] hover:bg-[rgba(255,255,255,0.07)] active:translate-y-[1px]">
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  aria-hidden="true"
                  className="opacity-80"
                >
                  <path
                    d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Search posts or users…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="bg-transparent border-0 outline-none text-white w-[min(280px,48vw)] placeholder:text-[#aab9c2] placeholder:opacity-90"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-[0.55rem] items-center justify-center">
              {/* Privacy */}
              <label className="relative inline-flex items-center gap-[0.55rem] px-[0.8rem] py-[0.52rem] pr-9 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.12)] text-[#e9f9ff] backdrop-blur-[6px] shadow-[inset_0_0_0_1px_rgba(0,255,255,.06)] transition hover:border-[rgba(0,255,255,.35)] hover:bg-[rgba(255,255,255,0.07)]">
                <select
                  value={privacyFilter}
                  onChange={(e) => setPrivacyFilter(e.target.value as any)}
                  className="appearance-none bg-transparent border-0 text-white outline-none p-0"
                >
                  <option value="all">All</option>
                  <option value="public">Public</option>
                  <option value="followers">Followers</option>
                  <option value="custom">Custom</option>
                </select>
              </label>

              {/* Sort */}
              <label className="relative inline-flex items-center gap-[0.55rem] px-[0.8rem] py-[0.52rem] pr-9 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.12)] text-[#e9f9ff] backdrop-blur-[6px] shadow-[inset_0_0_0_1px_rgba(0,255,255,.06)] transition hover:border-[rgba(0,255,255,.35)] hover:bg-[rgba(255,255,255,0.07)]">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="appearance-none bg-transparent  border-0  outline-none p-0 hover:text-[rgba(0,255,255)]"
                >
                  <option value="new">Newest</option>
                  <option className="bg-[rgba(255,255,255,0.05)]" value="old">Oldest</option>
                </select>
              </label>

              {/* Toggles */}
              <label className="cursor-pointer select-none inline-flex items-center gap-[0.55rem] px-[0.8rem] py-[0.52rem] rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.12)] text-[#e9f9ff] backdrop-blur-[6px] shadow-[inset_0_0_0_1px_rgba(0,255,255,.06)] transition hover:border-[rgba(0,255,255,.35)] hover:bg-[rgba(255,255,255,0.07)]">
                <input
                  type="checkbox"
                  checked={hasImageOnly}
                  onChange={(e) => setHasImageOnly(e.target.checked)}
                  className="hidden"
                />
                <span className="relative pl-5">
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-[3px] border border-[rgba(255,255,255,0.35)] bg-[rgba(255,255,255,0.06)] shadow-[inset_0_0_0_1px_rgba(0,0,0,.35)]" />
                  {hasImageOnly && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-[3px] shadow-[0_0_10px_rgba(0,255,255,.45)] bg-[radial-gradient(circle_at_50%_50%,rgba(0,255,255,.9),rgba(0,255,255,.35))] border border-[rgba(0,255,255,.8)]" />
                  )}
                  Has image
                </span>
              </label>

              <label className="cursor-pointer select-none inline-flex items-center gap-[0.55rem] px-[0.8rem] py-[0.52rem] rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.12)] text-[#e9f9ff] backdrop-blur-[6px] shadow-[inset_0_0_0_1px_rgba(0,255,255,.06)] transition hover:border-[rgba(0,255,255,.35)] hover:bg-[rgba(255,255,255,0.07)]">
                <input
                  type="checkbox"
                  checked={mineOnly}
                  onChange={(e) => setMineOnly(e.target.checked)}
                  className="hidden"
                />
                <span className="relative pl-5">
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-[3px] border border-[rgba(255,255,255,0.35)] bg-[rgba(255,255,255,0.06)] shadow-[inset_0_0_0_1px_rgba(0,0,0,.35)]" />
                  {mineOnly && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-[3px] shadow-[0_0_10px_rgba(0,255,255,.45)] bg-[radial-gradient(circle_at_50%_50%,rgba(0,255,255,.9),rgba(0,255,255,.35))] border border-[rgba(0,255,255,.8)]" />
                  )}
                  My posts
                </span>
              </label>

              {anyFilterActive && (
                <button
                  type="button"
                  className="inline-flex items-center gap-[0.55rem] px-[0.8rem] py-[0.52rem] rounded-full bg-[rgba(255,0,255,0.06)] border border-[rgba(255,0,255,0.2)] text-[#e9f9ff] font-bold transition hover:bg-[rgba(255,0,255,0.1)] hover:border-[rgba(255,0,255,0.4)]"
                  onClick={() => {
                    setQ("");
                    setPrivacyFilter("all");
                    setHasImageOnly(false);
                    setMineOnly(false);
                    setSortOrder("new");
                  }}
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </section>
          {/* ========= /FILTER PILL BAR ========= */}

          {/* Posts */}
          <div className="max-w-[640px]  mx-auto my-8 mt-24 px-4 font-[Segoe_UI,sans-serif] text-white">
            {message && (
              <div
                className={[
                  "bg-[#2a2a2a] px-4 py-3 rounded-md mb-8 border",
                  message.includes("successfully")
                    ? "text-[#8f8] border-[#4c4]"
                    : "text-[#f88] border-[#c44]",
                ].join(" ")}
              >
                {message}
              </div>
            )}

            {/* <h3 className="text-[1.25rem] mb-4 font-semibold">Posts</h3> */}

            {filteredPosts.length === 0 ? (
              <p className="text-[#999] mb-[55vh]">
                No posts match your filters.
              </p>
            ) : (
              filteredPosts.map((post, idx) => {
                const displayName =
                  post.nickname && post.nickname.trim()
                    ? post.nickname
                    : post.firstName && post.lastName
                      ? `${post.firstName} ${post.lastName}`
                      : post.user_id;

                const initial = displayName.charAt(0)?.toUpperCase() || "?";
                const imgSrc = post.image ? `/uploads/${post.image}` : null;
                const cList = comments[Number(post.post_id)] || [];

                return (
                  <div
                    key={idx}
                    className="opacity-0 [animation-name:fadeUpScale] [animation-duration:700ms] [animation-timing-function:cubic-bezier(.22,.61,.36,1)] [animation-fill-mode:forwards] will-change-[transform,opacity,filter] bg-[linear-gradient(180deg,#181818,#151515)] p-4 pb-3.5 mb-6 relative overflow-hidden border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-[0_0_8px_rgba(0,255,255,0.15),0_0_18px_rgba(255,0,255,0.12)]"
                    style={{ animationDelay: `${idx * 80}ms` }}
                  >
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
                        {(() => {
                          const avatarUrl = post.avatar
                            ? post.avatar.startsWith("/")
                              ? post.avatar
                              : `/avatars/${post.avatar}`
                            : null;
                          return avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={`${displayName} avatar`}
                              className="w-12 h-12 rounded-full object-cover shadow-[0_0_10px_rgba(0,255,255,.25)] border border-[rgba(255,255,255,0.08)]"
                              loading="lazy"
                              decoding="async"
                              onClick={(e) => {
                                e.preventDefault();
                                handleProfileClick(post.user_id);
                              }}
                            />
                          ) : (
                            <div
                              className="grid place-items-center rounded-full font-bold uppercase text-black w-12 h-12 text-[1.1rem] shadow-[0_0_10px_rgba(0,255,255,.25)]"
                              aria-hidden="true"
                              style={{
                                background:
                                  "radial-gradient(circle at 30% 30%, #00ffcc, #66ffff), #00ffcc",
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                handleProfileClick(post.user_id);
                              }}
                            >
                              {initial}
                            </div>
                          );
                        })()}

                        <div>
                          <strong
                            className="text-[1.05rem] font-bold"
                            onClick={(e) => {
                              e.preventDefault();
                              handleProfileClick(post.user_id);
                            }}
                          >
                            {displayName}
                          </strong>
                          <div className="flex items-center gap-2 text-[#9aa] text-[0.85rem]">
                            <span>{relTime(post.created_at)}</span>
                            <span className="w-1 h-1 rounded-full bg-[#666] opacity-80" />
                            <span>
                              {new Date(post.created_at).toLocaleDateString()}
                            </span>
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
                        (expanded[idx]
                          ? ""
                          : "overflow-hidden [display:-webkit-box] [-webkit-line-clamp:4] [-webkit-box-orient:vertical]") +
                        " whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[#eaeaea] leading-[1.5] my-1"
                      }
                    >
                      {post.content}
                    </p>

                    {post.content && post.content.length > 160 && (
                      <button
                        className="bg-transparent border-0 text-[#9ad] cursor-pointer p-0 mt-1 font-semibold text-[0.9rem] hover:underline"
                        onClick={() =>
                          setExpanded((p) => ({ ...p, [idx]: !p[idx] }))
                        }
                      >
                        {expanded[idx] ? "See less" : "See more"}
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

                    {/* action bar */}
                    <div className="flex items-center gap-2.5 pt-2 pb-1 px-1">
                      <button
                        type="button"
                        onClick={() => handleLike(Number(post.post_id))}
                        className="inline-flex items-center gap-2 rounded-[10px] bg-[#232323] text-[#eee] border border-[rgba(255,255,255,0.12)] px-3 py-1.5 cursor-pointer font-semibold text-[0.9rem] transition hover:-translate-y-[1px] hover:border-[rgba(0,255,255,.35)] hover:bg-[#2a2a2a]"
                      >
                        {likedPosts[Number(post.post_id)] ? "❤️" : "🤍"}

                        {post.like_count ? (
                          <span className="opacity-85">{post.like_count}</span>
                        ) : (
                          ""
                        )}
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-[10px] bg-[#232323] text-[#eee] border border-[rgba(255,255,255,0.12)] px-3 py-1.5 cursor-pointer font-semibold text-[0.9rem] transition hover:-translate-y-[1px] hover:border-[rgba(0,255,255,.35)] hover:bg-[#2a2a2a]"
                        onClick={() => {
                          if (!openComments[idx])
                            fetchComments(Number(post.post_id));
                          setOpenComments((prev) => ({
                            [idx]: !prev[idx],
                          }));
                        }}
                        aria-expanded={!!openComments[idx]}
                        aria-controls={`comments-${idx}`}
                      >
                        💬
                        {post.comment_count ? (
                          <span className="opacity-85">
                            {post.comment_count}
                          </span>
                        ) : (
                          ""
                        )}
                      </button>
                    </div>
                    <FollowedLikes post={post} />
                    {/* comments panel */}
                    {openComments[idx] && (
                      <div
                        id={`comments-${idx}`}
                        className="mt-2.5 p-3 rounded-[12px] bg-[#191919] border border-[rgba(255,255,255,0.08)]"
                      >
                        {/* add comment */}
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            submitCommentQuick(Number(post.post_id));
                          }}
                        >
                          <div className="flex flex-col items-start gap-2">
                            <div className="flex items-center gap-2 w-full">
                              <textarea
                                value={CommentForm.content}
                                onChange={handleCommentChange}
                                onKeyDown={onEnterSubmit(() => submitCommentQuick(Number(post.post_id)))}
                                name="content"
                                placeholder="Write a comment"
                                rows={2}
                                required
                                maxLength={150}
                                className="flex-1 bg-[#232323] text-white border border-[#444] rounded-[10px] px-3 py-2 resize-none"
                              />
                              <button
                                type="submit"
                                className="inline-flex items-center gap-2 rounded-[10px] bg-[#232323] text-[#eee] border border-[rgba(255,255,255,0.12)] px-3 py-1.5 cursor-pointer font-semibold text-[0.9rem] transition hover:-translate-y-[1px] hover:border-[rgba(0,255,255,.35)] hover:bg-[#2a2a2a] whitespace-nowrap"
                              >
                                Send
                              </button>
                            </div>

                            <div className="text-[12px] text-[#9aa] -mt-1">
                              Press <b>Enter</b> to send · <b>Shift+Enter</b> for new line
                            </div>

                            <div
                              className={[
                                "mb-4 border-2 w-full border-dashed rounded-lg p-4 bg-[#151515] transition-colors overflow-hidden",
                                dragActiveComment
                                  ? "border-cyan-400 bg-[#111]"
                                  : "border-[#555]",
                              ].join(" ")}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setDragActiveComment(true);
                              }}
                              onDragLeave={() => setDragActiveComment(false)}
                              onDrop={handleDropComment}
                            >
                              <div className="flex justify-between w-full items-center gap-2">
                                <div className="flex-1">
                                  <div className="font-semibold mb-1">
                                    Add an image
                                  </div>
                                  <div className="text-sm text-[#888]">
                                    Drag & drop, or click “Choose”
                                  </div>
                                  {CommentForm.imageFile && (
                                    <div className="text-xs text-[#ccc] mt-1">
                                      {CommentForm.imageFile.name}
                                    </div>
                                  )}
                                </div>

                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className="px-3 py-1.5 text-[0.85rem] rounded-md border-0 cursor-pointer bg-[#0ff] text-black"
                                    onClick={() =>
                                      commentFileInputRef.current?.click()
                                    }
                                  >
                                    Choose
                                  </button>
                                  {CommentForm.imageFile && (
                                    <button
                                      type="button"
                                      className="px-3 py-1.5 text-[0.85rem] rounded-md border-0 cursor-pointer bg-[#232323] text-white"
                                      onClick={() => {
                                        if (commentFileInputRef.current)
                                          commentFileInputRef.current.value =
                                            "";
                                        setCommentImageFile(null);
                                      }}
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                            <input
                              ref={commentFileInputRef}
                              type="file"
                              name="image"
                              accept=".jpg,.jpeg,.png,.gif,image/jpeg,image/png,image/gif"
                              className="hidden"
                              onChange={handleCommentFileChange}
                            />

                            {previewUrlComment && (
                              <img
                                src={previewUrlComment}
                                alt="Preview"
                                className="block max-w-full max-h-[240px] mt-3 rounded-lg object-contain bg-black"
                              />
                            )}
                          </div>
                        </form>
                        {cList.length === 0 ? (
                          <div className="text-[#9aa] text-[0.9rem] mb-2">
                            Be the first to comment.
                          </div>
                        ) : (
                          <div className="grid gap-2 mb-2">
                            {cList.map((c, i) => {
                              const displayName =
                                c.nickname && c.nickname.trim()
                                  ? c.nickname
                                  : c.firstName && c.lastName
                                    ? `${c.firstName} ${c.lastName}`
                                    : c.user_id;

                              const initial =
                                displayName.charAt(0)?.toUpperCase() || "?";
                              const imgSrc = c.image
                                ? `/uploads/${c.image}`
                                : null;
                              const cAvatar =
                                avatarUrlFor(c.avatar) ||
                                avatarUrlFor(
                                  usersById[String(c.user_id)]?.avatar
                                );
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
                                        aria-hidden="true"
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
                                      className="font-bold"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        handleProfileClick(c.user_id);
                                      }}
                                    >
                                      {displayName}
                                    </div>
                                    <div className="text-[#9aa] text-[0.8rem]">
                                      {relTime(c.created_at)}
                                    </div>
                                  </div>
                                  <div className="ml-[2.3rem] whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[#ddd] leading-[1.35]">
                                    {c.text}
                                  </div>

                                  {imgSrc && (
                                    <img
                                      src={imgSrc}
                                      alt="Post"
                                      className="w-full rounded-[12px] max-h-[210px] object-cover my-2 shadow-[0_8px_20px_rgba(0,0,0,.35)] transition hover:scale-[1.02] hover:shadow-[0_12px_28px_rgba(0,0,0,.45)] cursor-zoom-in"
                                      onClick={() => setLightboxSrc(imgSrc)}
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
              })
            )}
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
        </div>

        {/* keyframes (scoped via style tag) */}
        <style jsx>{`
          @keyframes glowMove {
            0% {
              transform: rotate(0deg) scale(1);
            }
            50% {
              transform: rotate(180deg) scale(1.05);
            }
            100% {
              transform: rotate(360deg) scale(1);
            }
          }
          @keyframes borderFlow {
            0% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
            100% {
              background-position: 0% 50%;
            }
          }
          @keyframes pulseGlow {
            0% {
              box-shadow:
                0 0 5px #00ffff,
                0 0 10px #ff00ff,
                0 0 15px #00ff99;
            }
            50% {
              box-shadow:
                0 0 15px #00ffff,
                0 0 20px #ff00ff,
                0 0 25px #00ff99;
            }
            100% {
              box-shadow:
                0 0 5px #00ffff,
                0 0 10px #ff00ff,
                0 0 15px #00ff99;
            }
          }
          @keyframes fadeUpScale {
            0% {
              opacity: 0;
              transform: translateY(30px) scale(0.97);
              filter: blur(2px);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
              filter: blur(0);
            }
          }
        `}</style>
        {ViewingProfile && (

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/70"
            onClick={() => setViewingProfile(null)}>
            <div className="relative w-full max-w-md"
              onClick={(e) => e.stopPropagation()}>
              <button
                className="absolute -top-10 -right-7 text-white hover:text-gray-300 text-2xl transition-colors"
                onClick={() => setViewingProfile(null)}
              >
                ✕
              </button>
              {(() => {
                const normalizedUser = ViewingProfile
                  ? {
                    id: ViewingProfile.id,
                    name: `${ViewingProfile.firstName} ${ViewingProfile.lastName}`,
                    firstName: ViewingProfile.firstName,
                    lastName: ViewingProfile.lastName,
                    nickname: ViewingProfile.nickname,
                    avatar: ViewingProfile.avatar,
                    online: ViewingProfile.online,
                    isPublic: ViewingProfile.isPublic,
                  }
                  : null;

                return (
                  <ProfileCard
                    user={normalizedUser}
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
                    onContactClick={() => {
                      // i will handle contact logic here later
                    }}
                  />
                );
              })()}
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
    </>);
  }
}
