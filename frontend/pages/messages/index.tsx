"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ProfileCard from "@/components/profile/ProfileCard";
import { X, Search, Lock, Plus } from "lucide-react";
import Avatar from "@/components/ui/avatar";
import Navbar from "@/components/ui/navbar";
import {
  User,
  UserProfile,
  Relationship,
  Msg,
  Group,
  GroupFormType,
} from "@/types/user";
import GroupHeader from "@/components/groups/header";
import GroupForm from "@/components/groups/groupForm";
import MembersSelection from "@/components/groups/memberSelection";
import GroupInfo from "@/components/groups/groupInfoBox";
import GroupPanel from "@/components/groups/groupPanel";
import { useCallback } from "react";
import MessagesList from "@/components/messages/MessagesList";
import EventsList from '@/components/groups/events/eventsList'
import { toast, ToastContainer } from 'react-toastify';
import PostsList from "@/components/groups/posts/PostsList";
import PostCreateForm from "@/components/groups/posts/PostCreateForm";
import CreatePostModal from "@/components/groups/posts/PostCreateForm";
import type { GroupPostFormType } from "@/components/groups/posts/PostCreateForm";
import Head from "next/head";

type GroupTab = 'posts' | 'events' | 'chat';
const TABS: GroupTab[] = ['chat', 'posts', 'events'];

type PostType = 'browse' | 'create';

/** ---------- limit consts ---------- **/
const MAX_MESSAGE_LENGTH = 700;
const WARNING_THRESHOLD = 650;
const MAX_GROUP_TITLE_LENGTH = 20;
const MAX_GROUP_DESCRIPTION_LENGTH = 200;
const MAX_GROUP_MEMBERS = 50;
const MIN_GROUP_MEMBERS = 1;

/** ---------- TEMP FEATURE FLAG ---------- **/
// Set this to false when your real follow/public logic is ready.

const UNLOCK_ALL = false;

/** ---------- Types ---------- **/
//find types in types folder

/** Small helpers */
const cls = (...a: (string | false | undefined)[]) =>
  a.filter(Boolean).join(" ");
const relTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(1, Math.floor(diff / 1000));
  const m = Math.floor(s / 60),
    h = Math.floor(m / 60),
    d = Math.floor(h / 24);
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
};
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
function dayLabelFor(d: Date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString();
}

export default function MessagesPage() {
  const [posting, setPosting] = useState(false);
  const [postsRefreshKey, setPostsRefreshKey] = useState(0);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);

  const submitCreatePost = async (form: GroupPostFormType) => {
    if (!selectedGroup) return;

    setPosting(true);
    try {
      const fd = new FormData();
      fd.append("group_id", String(selectedGroup.id));
      fd.append("content", form.content);

      if (form.image) {
        fd.append("image", form.image, form.image.name);
      }

      //check valid extension

      const res = await fetch("/api/group/posts/create", {
        method: "POST",
        body: fd,
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const raw = await res.text();
      let data: any = {};
      if (raw) { try { data = JSON.parse(raw); } catch { /* non-JSON */ } }

      if (!res.ok) {
        let msg = (data && (data.error || data.message)) || raw || res.statusText || "Failed to create post";

        if (res.status === 401 || res.status === 403) {
          msg = "You're not authorized to post here. Please sign in or join the group.";
        } else if (res.status === 404) {
          msg = "Group not found (404).";
        } else if (res.status === 413) {
          msg = "Image is too large (413). Try a smaller file.";
        } else if (res.status === 415) {
          msg = "Unsupported image type (415). Use JPG/PNG/GIF.";
        } else if (res.status === 422) {
          msg = "Invalid post data (422). Make sure you included content or an image.";
        }

        throw new Error(msg);
      }

      toast.success("Post published");
      setPostsRefreshKey(k => k + 1);
      setShowCreatePostModal(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create post");
    } finally {
      setPosting(false);
    }
  };

  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});
  const TYPING_TTL = 1400;
  const [typingPeers, setTypingPeers] = useState<Record<string, number>>({});
  const markTyping = (peerId: string) => {
    setTypingPeers((prev) => ({ ...prev, [peerId]: Date.now() + TYPING_TTL }));
  };
  const clearTyping = (peerId: string) => {
    setTypingPeers((prev) => {
      if (!(peerId in prev)) return prev;
      const { [peerId]: _, ...rest } = prev;
      return rest;
    });
  };
  const [groupTab, setGroupTab] = useState<GroupTab>("chat");
  const [groupPostTab, setGroupPostTab] = useState<PostType>('browse');

  const [mobileView, setMobileView] = useState<"list" | "chat" | "no">("no");

  const lastTypingSentRef = useRef(0);
  const wasTypingRef = useRef(false);
  const [ViewingProfile, setViewingProfile] = useState<UserProfile | null>(
    null
  );
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
  useEffect(() => {
    const iv = setInterval(() => {
      setTypingPeers((prev) => {
        const now = Date.now();
        let changed = false;
        const next: Record<string, number> = {};
        for (const [k, until] of Object.entries(prev)) {
          if (until > now) next[k] = until;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 250);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        // Always show both panes on desktop
        setMobileView("no");
      } else {
        // On mobile, default to list view
        setMobileView("list");
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const router = useRouter();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const rememberId = (id: string) => {
    const s = seenIdsRef.current;
    if (s.has(id)) return true;
    s.add(id);
    // cap to avoid unbounded growth
    if (s.size > 500) {
      // drop 200 oldest-ish (simple reset is fine for UI)
      seenIdsRef.current = new Set(Array.from(s).slice(-300));
    }
    return false;
  };
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();

    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    // Today: just the time
    if (sameDay) {
      return d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit" /*, hour12: false */,
      });
    } else {
      return d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit" /*, hour12: false */,
      });
    }
  };
  const LAST_TS_KEY = "lastTsByUser:v1";
  const [lastTsByUser, setLastTsByUser] = useState<Record<string, number>>({});

  // load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_TS_KEY);
      if (raw) setLastTsByUser(JSON.parse(raw));
    } catch { }
  }, []);

  // small helper to upsert and persist
  const bumpLastTs = (peerId: string, isoTs: string) => {
    const ts = new Date(isoTs).getTime();
    setLastTsByUser((prev) => {
      const next = { ...prev, [peerId]: Math.max(prev[peerId] || 0, ts) };
      try {
        localStorage.setItem(LAST_TS_KEY, JSON.stringify(next));
      } catch { }
      return next;
    });
  };

  /** ---------- Auth / Me ---------- **/
  const [meId, setMeId] = useState("");
  const [meNick, setMeNick] = useState("");
  const [me, setMe] = useState<User | null>(null);

  /** ---------- UI State ---------- **/
  const [scrolled, setScrolled] = useState(false);
  const [tab, setTab] = useState<"direct" | "groups">("direct");

  /** ---------- Data ---------- **/
  const [users, setUsers] = useState<User[]>([]);
  const usersMapRef = useRef<Record<string, User>>({});

  useEffect(() => {
    const m: Record<string, User> = {};
    for (const u of users) m[String(u.id)] = u;
    usersMapRef.current = m;
  }, [users]);
  const [query, setQuery] = useState("");
  const [inviteQuery, setinviteQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [relationships, setRelationships] = useState<
    Record<string, Relationship>
  >({});

  /** ---------- Group ---------- **/
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [usersForInvite, setUsersForInvite] = useState<User[]>([]);
  const [selectedGroupUsers, setSelectedGroupUsers] = useState<User[]>([]);
  const [groupCreationStep, setGroupCreationStep] = useState<
    "form" | "members"
  >("form");
  const [tempselectedGroupUsers, setTempselectedGroupUsers] = useState<User[]>(
    []
  );
  const [pendingFollowReqs, setPendingFollowReqs] = useState(0);
  const [showAllGroups, setShowAllGroups] = useState(true);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [groupsViewMode, setGroupsViewMode] = useState<
    "browse" | "panel" | "create"
  >("browse");
  const [groupForm, setGroupForm] = useState<{
    title: string;
    description: string;
    members: string[];
  }>({
    title: "",
    description: "",
    members: [],
  });
  const [validationErrors, setValidationErrors] = useState<{
    title?: string;
    description?: string;
    members?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [selectedGroupForInfo, setSelectedGroupForInfo] =
    useState<Group | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [groupTypingPeers, setGroupTypingPeers] = useState<
    Record<string, Set<string>>
  >({});
  const [groupMembers, setGroupMembers] = useState<Record<string, User[]>>({});

  const [msgsByUser, setMsgsByUser] = useState<Record<string, Msg[]>>({});
  const [msgsByGroup, setMsgsByGroup] = useState<Record<string, Msg[]>>({});
  // --- WebSocket state ---
  const wsRef = useRef<WebSocket | null>(null)
  const [wsReady, setWsReady] = useState(false)
  const selectedUserRef = useRef<User | null>(null);
  const tabRef = useRef<'direct' | 'groups'>('direct');
  function resolveSenderName(fromId: string, content: any): string {
    const u = usersMapRef.current[String(fromId)];
    const nameFromPayload =
      (content?.nickname ??
        [content?.Name ?? content?.firstName, content?.lastName ?? content?.lastName]
          .filter(Boolean)
          .join(' '))
        ?.trim();

    return (
      u?.nickname ||
      u?.name ||
      nameFromPayload ||
      `@${fromId}`
    );
  }

  const isSelectedChatOpenRef = useRef(false);
  useEffect(() => { selectedUserRef.current = selectedUser }, [selectedUser]);
  useEffect(() => { tabRef.current = tab }, [tab]);
  const isDmOpenWith = (userId: string) =>
    tabRef.current === 'direct' &&
    String(selectedUserRef.current?.id ?? '') === String(userId);

  function getPeerIdFromNotification(n: { content?: any }, meId: string): string {
    const c = n?.content || {};

    const pick = (...ks: string[]) => {
      for (const k of ks) {
        const v = c[k];
        if (v !== undefined && v !== null && String(v) !== '') return String(v);
      }
      return '';
    };

    const from = pick('from', 'fromId', 'senderId', 'sender_id', 'userId', 'user_id', 'authorId');
    const to = pick('to', 'toId', 'recipientId', 'recipient_id', 'peerId');

    if (from && from !== String(meId)) return from;
    if (to && to !== String(meId)) return to;

    return from || to || '';
  }

  useEffect(() => {
    const recompute = () => {
      isSelectedChatOpenRef.current =
        tabRef.current === 'direct' &&
        !!selectedUserRef.current &&
        !document.hidden;
    };
    recompute();
    document.addEventListener('visibilitychange', recompute);
    return () => document.removeEventListener('visibilitychange', recompute);
  }, []);
  const isChatOpenFor = (userId: string) =>
    tabRef.current === 'direct' &&
    !document.hidden &&
    String(selectedUserRef.current?.id ?? '') === String(userId);
  const openGroupPanel = useCallback(() => {
    setTab('groups');
    setGroupsViewMode('panel');
    setShowAllGroups(false);
    localStorage.setItem('intent:openGroupPanel', '1');
  }, [setTab, setGroupsViewMode, setShowAllGroups]);


  const openGroupEvents = useCallback(() => {
    setTab('groups');
    const gid = localStorage.getItem("intent:groupId")
  
  const target = allGroups.find(g => String(g.id) === String(gid));
  if (!target) return;
    setSelectedGroup(target);
    setGroupTab('events');
    setShowAllGroups(false);
    localStorage.setItem('intent:openGroupEvents', '1');
  }, [setTab, setSelectedGroup,setGroupTab, setShowAllGroups]);

  useEffect(() => {
    const intent = localStorage.getItem('intent:openGroupPanel');
    const intent2 = localStorage.getItem('intent:openGroupEvents');
    if (intent) {
      openGroupPanel();
      localStorage.removeItem('intent:openGroupPanel');
    }else if (intent2){
      openGroupEvents();
      localStorage.removeItem('intent:openGroupEvents');
    }
  }, [openGroupPanel, openGroupEvents]);

  const notifyGroupMembership = (groupId: number | string, status: 'invited' | 'requested' | 'accepted' | 'declined' | 'left' | 'deleted') => {
    const idNum = Number(groupId);
    window.dispatchEvent(new CustomEvent('group:membership', {
      detail: { groupId: isNaN(idNum) ? String(groupId) : idNum, status },
    }));
  };
  useEffect(() => {
    const onMembership = (e: Event) => {
      const { groupId, status } = (e as CustomEvent).detail || {};
      const same = (a: string | number, b: string | number) => String(a) === String(b);

      setAllGroups(prev =>
        prev.map(g => {
          if (!same(g.id, groupId)) return g;
          const next = { ...g };
          if (status === 'accepted') {
            next.is_member = true;
            if (typeof next.member_count === 'number') next.member_count = Math.max(1, next.member_count + 1);
          } else if (status === 'left' || status === 'declined') {
            next.is_member = false;
            if (typeof next.member_count === 'number') next.member_count = Math.max(0, next.member_count - 1);
          } else if (status === 'deleted') {
          }
          return next;
        }).filter(g => (status === 'deleted' && same(g.id, groupId)) ? false : true)
      );

      setSelectedGroup(prev => {
        if (!prev || !same(prev.id, groupId)) return prev;
        const next = { ...prev };
        if (status === 'accepted') {
          next.is_member = true;
          if (typeof next.member_count === 'number') next.member_count = Math.max(1, next.member_count + 1);
        } else if (status === 'left' || status === 'declined') {
          next.is_member = false;
          if (typeof next.member_count === 'number') next.member_count = Math.max(0, next.member_count - 1);
        } else if (status === 'deleted') {
          return null;
        }
        return next;
      });
    };

    window.addEventListener('group:membership', onMembership as EventListener);
    return () => window.removeEventListener('group:membership', onMembership as EventListener);
  }, []);
  const [eventsRefreshKeyByGroup, setEventsRefreshKeyByGroup] = useState<Record<string, number>>({});
  const bumpEventsRefresh = useCallback((gid: string) => {
    setEventsRefreshKeyByGroup(prev => ({ ...prev, [gid]: (prev[gid] || 0) + 1 }));
  }, []);

  const selectedGroupRef = useRef<Group | null>(null);
  useEffect(() => { selectedGroupRef.current = selectedGroup }, [selectedGroup]);

  const groupTabRef = useRef<GroupTab>('chat');
  useEffect(() => { groupTabRef.current = groupTab }, [groupTab]);
  useEffect(() => {
    if (!meId) return

    const hostname = window.location.hostname;
    const ws = new WebSocket(`ws://` + hostname + `:8080/ws`) // cookies auto-sent
    wsRef.current = ws

    ws.onopen = () => setWsReady(true)
    ws.onclose = () => setWsReady(false)
    ws.onerror = () => setWsReady(false)

    ws.onmessage = (ev: MessageEvent) => {
      try {
        const env = JSON.parse(ev.data)

        if (env.type === "dm") {
          const m = env.data as { id?: string; clientId?: string; from: string; to: string; text: string; ts: string };

          const peerId = (m.from === meId) ? m.to : m.from;

          // If that DM is open, clear any pending notif server-side
          if (isDmOpenWith(peerId) && m.id) {
            fetch("/api/notifications/read-by-message", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ messageId: m.id }),
            }).catch(() => { });
          }

          const dedupeKey = m.id || m.clientId;
          if (dedupeKey && rememberId(dedupeKey)) return;

          setMsgsByUser(prev => ({
            ...prev,
            [peerId]: [
              ...(prev[peerId] || []),
              { id: m.id || m.clientId!, from: m.from, to: m.to, text: m.text, ts: m.ts, seen: false }
            ]
          }));
          bumpLastTs(peerId, m.ts);
          clearTyping(peerId);
        }

        if (env.type === "presence_snapshot") {
          const list: string[] = Array.isArray(env.data?.online) ? env.data.online : []
          const map: Record<string, boolean> = {}
          for (const id of list) map[id] = true
          setOnlineMap(map)
        }

        if (env.type === "presence") {
          const { userId, online } = env.data || {}
          if (typeof userId === 'string') {
            setOnlineMap(prev => ({ ...prev, [userId]: !!online }))
          }
        }
        if (env.type === "typing") {
          const { from, stop } = env.data || {}
          if (from && from !== meId) {
            stop ? clearTyping(from) : markTyping(from)
          }
        }
        if (env.type === "initial_group_invite_list") {
          const n = env.data as { id: number; type: string; content: any }[];
          if (Array.isArray(n)) {
            setPendingFollowReqs(n.length);
          }

        }
        if (env.type === "notification.created") {
          const n = env.data as { id: number; type: string; content: any };


          if (n.type === "dm") {
            const peerId = getPeerIdFromNotification(n, meId);
            const mid = n.content?.messageId ? String(n.content.messageId) : "";

            if (peerId && isDmOpenWith(peerId)) {
              if (mid) {
                fetch("/api/notifications/read-by-message", {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ messageId: mid }),
                }).catch(() => { });
              }
              return;
            }

            const name = resolveSenderName(peerId || n.content?.from, n.content);
            toast.info(`💬 ${name}: ${n.content?.text ?? ""}`, {
              onClick: () => {
                setTab("direct");
                const target = usersMapRef.current[String(peerId)];
                if (target) setSelectedUser(target);
                else if (peerId) localStorage.setItem("intent:openDM", String(peerId));
              },
            });
            return;
          }


          if (n.type === "group_invite") {
            toast(`📨 Group invite: ${n.content.groupName}`);
          }

          if (n.type === "group_event_created") {
            const gid = String(n.content?.groupId ?? n.content?.group_id ?? "");
            const gTitle = n.content?.groupTitle ?? "your group";

            // If you're already looking at this group's Events tab, refresh silently
            const isOpenNow =
              tabRef.current === "groups" &&
              selectedGroupRef.current &&
              String(selectedGroupRef.current.id) === gid &&
              groupTabRef.current === "events" &&
              !document.hidden;

            if (gid) bumpEventsRefresh(gid);

            if (!isOpenNow) {
              toast.success(`📅 New event in ${gTitle}`, {
                onClick: () => {
                  setTab("groups");
                  setGroupTab("events");

                  const target = allGroups.find(g => String(g.id) === gid);
                  if (target) {
                    setSelectedGroup(target);
                  } else {
                    // If groups aren’t loaded yet, stash the intent
                    localStorage.setItem("intent:openGroup", gid);
                    localStorage.setItem("intent:groupTab", "events");
                  }
                },
              });
            }
            return;
          }

          if (n.type === 'follow_request') {
            const followerId = String(n.content?.followerId ?? '');
            const name = resolveSenderName(followerId, n.content);
            toast.info(`🔔 New follow request from ${name}`, {
              onClick: () => {
                localStorage.setItem('intent:openFollowRequests', '1');
                router.push(`/profile/${meId}`);
              },
            });
          }


          if (n.type === "follow_request.update") {
            const status = String(n.content?.status ?? "");
            const followingId = String(n.content?.followingId ?? "");

            if (status === "accepted") {
              toast.success("Follow request accepted");

              setRelationships(prev => ({
                ...prev,
                [followingId]: { ...(prev[followingId] || {}), iFollow: true },
              }));

              if (String(selectedUser?.id) === followingId) {
                toast.info("💬 Chat unlocked");
              }
            } else if (status === "declined") {
              toast.error(` Follow request declined`);

              setRelationships(prev => ({
                ...prev,
                [followingId]: { ...(prev[followingId] || {}), iFollow: false },
              }));
            }
          }
          if (env.type === "badge.follow_requests") {
            const count = Number(env.data?.count ?? 0);
            setPendingFollowReqs(count);
          }


        }
        if (env.type === "group_invite") {
          const gTitle = env.data?.groupTitle ?? "a group";
          toast.info(`📨 Group invite: ${gTitle}`, {
            onClick: () => openGroupPanel(),
          });
        }

        if (env.type === "group_invite.accepted") {
          fetchGroupMembers(env.data?.groupId || "", true)
          const uid = String(env.data?.userId ?? "");
          const name = resolveSenderName(uid, env.data);
          toast.success(` ${name} accepted your group invite`, {
            onClick: () => openGroupPanel(),
          });
        }
        if (env.type === "group_invite.declined") {
          const uid = String(env.data?.userId ?? "");
          const name = resolveSenderName(uid, env.data);
          toast.error(`${name} declined your group invite`, {
            onClick: () => openGroupPanel(),
          });
        }
  const goGroupPanel = (groupId?: string) => {
    if (groupId) localStorage.setItem("intent:groupId", String(groupId));
    localStorage.setItem("intent:openGroupPanel", "1");
    router.push("/messages");
  };
        if (env.type === "group_request.created") {
          const getGroupId = (obj: any) =>
    String(obj?.groupId ?? obj?.groupID ?? obj?.group_id ?? "");

          const gTitle = env.data?.groupTitle ?? "your group";
          toast.info(`📝 Join request for ${gTitle}`, {
            onClick: () => openGroupPanel(),
          });
          // const whoId = String(env.data?.userId ?? env.data?.requesterId ?? "");
          //           const who = resolveSenderName(whoId, env.data);
          //           const g = env.data?.groupTitle ?? "your group";
          //           const gid = getGroupId(env.data);
          //           toast.info(`🙋 ${who} requested to join ${g}`, {
          //             onClick: () => goGroupPanel(gid),
          //             closeOnClick: true,
          //           });
          //           return;
        }

        if (env.type === "group_request.update") {
          const status = String(env.data?.status ?? "");
          const pretty =
            status === "accept" ? "accepted 🎉" :
              status === "decline" ? "declined ❌" : status;

          toast(`📢 Your join request was ${pretty}`, {
            onClick: () => {
              setTab("groups");
              setGroupsViewMode("browse");
              setShowAllGroups(true);
              fetchAllGroups();
            },
          });


          if (status === "accept") {
            fetchGroupMessages(new AbortController, env.data?.groupId || "")

          }

        }

        if (env.type === "initial_group_invite_list") {
          const arr = Array.isArray(env.data?.content) ? env.data.content : [];
        }

        if (env.type === "remove_initial_group_invite_list") {
        }

        if (env.type === "user_left_group") {


          toast(`👋 You left the group`, {
            onClick: () => {
              setTab("groups");
              setGroupsViewMode("browse");
              setShowAllGroups(true);
              fetchAllGroups();
            },
          });
        }
        if (env.type === "group_deleted") {
          toast(`🗑️ Group deleted`, {
            onClick: () => {
              setTab("groups");
              setGroupsViewMode("browse");
              setShowAllGroups(true);
              fetchAllGroups();
            },
          });
        }

        if (env.type === "group_invite") {
          const gId = env.data?.groupId ?? env.data?.groupID ?? env.data?.group_id;
          notifyGroupMembership(gId, 'invited');
        }

        if (env.type === "request_to_join_group") {
          const gId = env.data?.groupId ?? env.data?.groupID ?? env.data?.group_id;
          notifyGroupMembership(gId, 'requested');
        }

        if (env.type === "group_request.update") {
          const gId = env.data?.groupId ?? env.data?.groupID ?? env.data?.group_id;
          const st = String(env.data?.status ?? '').toLowerCase(); // 'accept' | 'decline'
          fetchGroupMembers(gId || "", true)
          notifyGroupMembership(gId, st === 'accept' ? 'accepted' : 'declined');
        }

        if (env.type === "user_left_group") {
          const gId = env.data?.groupId ?? env.data?.groupID ?? env.data?.group_id;
          fetchGroupMembers(gId || "", true)
          notifyGroupMembership(gId, 'left');
        }

        if (env.type === "group_deleted") {
          const gId = env.data?.groupId ?? env.data?.groupID ?? env.data?.group_id;
          notifyGroupMembership(gId, 'deleted');
        }

        // if (env.type === "badge.unread") {
        //     const c = Number(env.data?.count ?? 0);

        // }
        else if (env.type === "group_message") {
          const m = env.data as { id?: string; from?: string; sender_id?: string; group_id?: string; groupId?: string; text?: string; content?: string; ts?: string; sent_at?: string; firstName?: string; lastName?: string; nickname?: string; avatar?: string }

          const mapped: Msg = {
            id: String(m.id ?? crypto.randomUUID()),
            from: String(m.from ?? m.sender_id ?? ''),
            groupId: String(m.groupId ?? m.group_id ?? ''),
            text: String(m.text ?? m.content ?? ''),
            ts: new Date(m.ts ?? m.sent_at ?? Date.now()).toISOString(),
            firstName: m.firstName,
            lastName: m.lastName,
            nickname: m.nickname,
            avatar: m.avatar,
          }



          if (rememberId(mapped.id)) return

          setMsgsByGroup(prev => ({
            ...prev,
            [mapped.groupId!]: [
              ...(prev[mapped.groupId!] || []),
              mapped
            ]
          }))

          // clear typing for that user in that group (optional keep)
          setGroupTypingPeers(prev => {
            const next = { ...prev }
            if (next[mapped.groupId!]) {
              const filtered = new Set<string>()
              next[mapped.groupId!].forEach(id => {
                if (id !== mapped.from) filtered.add(id)
              })
              next[mapped.groupId!] = filtered
            }
            return next
          })
        }


        if (env.type === "group_typing") {
          const { from, group_id, stop } = env.data || {}
          if (from && from !== meId && group_id) {
            setGroupTypingPeers(prev => {
              const newState = { ...prev }
              if (!newState[group_id]) {
                newState[group_id] = new Set()
              }
              if (stop) {
                newState[group_id].delete(from)
              } else {
                newState[group_id].add(from)
              }
              return newState
            })
          }
        }



      } catch (err) {
        console.error('WS parse error', err)
      }
    }


    return () => { ws.close() }
  }, [meId])
  // useEffect(() => {
  //     if (!users.length) return
  //     setUsers(prev => prev.map(u => ({ ...u, online: !!onlineMap[u.id] })))
  // }, [onlineMap])

  useEffect(() => {
    const targetId = localStorage.getItem('intent:openDM');
    if (!targetId) return;

    const target = users.find(u => String(u.id) === String(targetId));
    if (target) {
      setTab('direct');
      setSelectedUser(target);
    }
    localStorage.removeItem('intent:openDM');
  }, [users]);


  const prevUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    const gid = localStorage.getItem("intent:openGroup");
    if (!gid) return;

    const target = allGroups.find(g => String(g.id) === gid);
    if (target) {
      setTab("groups");
      setSelectedGroup(target);
      const desiredTab = (localStorage.getItem("intent:groupTab") as GroupTab) || "events";
      setGroupTab(desiredTab);
      localStorage.removeItem("intent:openGroup");
      localStorage.removeItem("intent:groupTab");
    }
  }, [allGroups]);

  useEffect(() => {
    const prevId = prevUserIdRef.current;
    if (
      prevId &&
      prevId !== selectedUser?.id &&
      wsRef.current?.readyState === WebSocket.OPEN &&
      wasTypingRef.current
    ) {
      wsRef.current.send(
        JSON.stringify({ type: "typing", data: { to: prevId, stop: true } })
      );
      wasTypingRef.current = false;
    }
    prevUserIdRef.current = selectedUser?.id ?? null;
  }, [selectedUser?.id]);

  useEffect(() => {
    if (tab !== "direct" || !selectedUser?.id || !meId) return;

    const controller = new AbortController();
    const peerId = selectedUser.id; // capture once

    (async () => {
      try {
        const r = await fetch(
          `/api/messages?peer_id=${encodeURIComponent(peerId)}`,
          { credentials: "include", signal: controller.signal }
        );
        if (!r.ok) return;

        // Defensive parse: coerce to array
        const data = await r.json().catch(() => []);
        const rows: Array<{
          id: string;
          from: string;
          to: string;
          text: string;
          ts: string;
        }> = Array.isArray(data) ? data : [];

        setMsgsByUser((prev) => {
          if (selectedUser?.id !== peerId) return prev;
          const mapped = rows.map((x) => ({
            id: x.id,
            from: x.from,
            to: x.to,
            text: x.text,
            ts: x.ts,
            seen: false,
          }));
          if (mapped.length) bumpLastTs(peerId, mapped[mapped.length - 1].ts);
          return { ...prev, [peerId]: mapped };
        });
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.error(err)
        }
      }
    })();

    return () => controller.abort();
  }, [tab, selectedUser?.id, meId]);

  /** Composer & typing */
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);

  /** ---------- Load me / users / groups / relationships ---------- **/
  useEffect(() => {
    const load = async () => {
      try {
        // 1) Who am I?
        const rMe = await fetch("/api/me", { credentials: "include" });
        if (!rMe.ok) {
          router.push("/login");
          return;
        }
        const me = await rMe.json();
        setMeId(me.id || "");
        setMeNick(me.nickname || "");
        const myId = me.id;

        //just make the struct equivalent to the upcoming json data
        const resUser = await fetch(`/api/users/${me.id}/user`, {
          credentials: "include",
        });

        if (resUser.ok) {
          const data = await resUser.json();
          setMe(data);
        }

        // 2) Users (filter out myself using myId from response, not state)
        const rUsers = await fetch("/api/users", { credentials: "include" });
        const rawUsers = await rUsers.json();
        let cleaned: User[] = (rawUsers || [])
          .filter((u: any) => u.id && u.id !== myId)
          .map((u: any): User => ({
            id: u.id,
            name: u.name || `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.nickname || u.id,
            firstName: u.firstName ?? '',
            lastName: u.lastName ?? '',
            nickname: u.nickname,
            avatar: u.avatar,
            isPublic: !!u.is_public,
            online: !!onlineMap[u.id],
          }));


        // 3) Relationships
        if (UNLOCK_ALL) {
          const rels: Record<string, Relationship> = {};
          for (const u of cleaned) {
            u.isPublic = true;
            rels[u.id] = { iFollow: true, followsMe: true };
          }
          setRelationships(rels);
        } else {
          try {
            const rRel = await fetch("/api/relationships", {
              credentials: "include",
            });
            if (rRel.ok) {
              const rel = await rRel.json();
              setRelationships(rel.relationships || {}); // <- use rel.relationships
            }
          } catch {
            /* ignore */
          }
        }

        setUsers(cleaned);
      } catch {
        router.push("/login");
        return;
      }
    };

    load();
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** ---------- Filters ---------- **/
  const filteredUsersForInvite = useMemo(() => {
    const q = inviteQuery.trim().toLowerCase();
    if (!q) return usersForInvite;
    return usersForInvite.filter(
      (u) =>
        (u.nickname || "").toLowerCase().includes(q) ||
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        (u.firstName.toLowerCase() + " " + u.lastName.toLowerCase()).includes(q)
    );
  }, [usersForInvite, inviteQuery]);

  const sortedUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = users.filter(
      (u) =>
        !q ||
        u.name.toLowerCase().includes(q) ||
        (u.nickname || "").toLowerCase().includes(q)
    );

    type Decorated = { user: User; lastTs: number };
    const decorated: Decorated[] = base.map((user) => {
      const arr = msgsByUser[user.id] || [];
      const last = arr.length ? arr[arr.length - 1] : undefined;
      const fromMsgs = last ? new Date(last.ts).getTime() : 0;
      const fromCache = lastTsByUser[user.id] || 0;
      return { user, lastTs: Math.max(fromMsgs, fromCache) };
    });

    decorated.sort((a, b) => {
      if (a.lastTs !== 0 || b.lastTs !== 0) {
        if (a.lastTs !== b.lastTs) return b.lastTs - a.lastTs;
        return a.user.name.localeCompare(b.user.name, undefined, {
          sensitivity: "base",
        });
      }
      return a.user.name.localeCompare(b.user.name, undefined, {
        sensitivity: "base",
      });
    });

    return decorated.map((d) => d.user);
  }, [users, query, msgsByUser, lastTsByUser]);

  useEffect(() => {
    if (tab !== "direct") return;
    if (!selectedUser && sortedUsers.length) {
      setSelectedUser(sortedUsers[0]);
    }
  }, [tab, sortedUsers, selectedUser]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allGroups
    return allGroups.filter(g => g.title.toLowerCase().includes(q))
  }, [allGroups, query])

  useEffect(() => {
    if (showAllGroups) {
      fetchAllGroups();
    }
  }, [showAllGroups]);

  const fetchAllGroups = async () => {
    try {
      const res = await fetch("/api/group/groups", {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();

        if (data.ok && data.groups) {
          setAllGroups(data.groups);
        }
      }
    } catch (error) {
      console.error("Failed to fetch groups:", error);
    }
  };

  /** ---------- Permission & instant rules ---------- **/
  const relFor = (uid?: string): Relationship | null =>
    uid ? relationships[uid] || null : null;

  const canDM = (u: User | null): boolean => {
    if (UNLOCK_ALL) return true;
    if (!u) return false;
    const rel = relFor(u.id);
    return !!(rel?.iFollow || rel?.followsMe);
  };

  const instantDeliveryMsg = (u: User | null): string => {
    if (UNLOCK_ALL) return "chat enabled";
    if (!u) return "";
    const rel = relFor(u.id);
    if (rel?.iFollow || rel?.followsMe) return "chat enabled";
    return "you can chat if they follow you or you follow them";
  };

  /** ---------- Messages computed ---------- **/
  const activeMsgs = useMemo(() => {
    if (tab === "direct" && selectedUser)
      return msgsByUser[selectedUser.id] || [];
    if (tab === "groups" && selectedGroup)
      return msgsByGroup[String(selectedGroup.id)] || [];
    return [];
  }, [tab, selectedUser, selectedGroup, msgsByUser, msgsByGroup]);

  /** ---------- Send  ---------- **/
  const send = () => {
    if (tab === "direct") {
      sendDM();
    } else if (tab === "groups" && groupTab === "chat") {
      sendGroupMessage();
    }
  };

  const sendDM = () => {
    const text = draft.trim();
    if (!text || !selectedUser || !meId) return;
    if (text.length > MAX_MESSAGE_LENGTH) {
      // alert(
      //   `Message is too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`
      // );
      toast.error(`Message is too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`);
      return;
    }
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const clientId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    // 1) tell the peer we stopped typing
    wsRef.current.send(
      JSON.stringify({
        type: "typing",
        data: { to: selectedUser.id, stop: true },
      })
    );
    wasTypingRef.current = false;

    // 2) clear their typing pill on OUR UI immediately
    clearTyping(selectedUser.id);

    // 3) send the actual message
    wsRef.current.send(
      JSON.stringify({
        type: "dm",
        data: { to: selectedUser.id, text, clientId },
      })
    );

    bumpLastTs(selectedUser.id, nowIso);

    setDraft("");
    setTyping(false);
    setShowEmoji(false);
  };

  useEffect(() => {
    const stopNow = () => {
      if (
        wsRef.current?.readyState === WebSocket.OPEN &&
        wasTypingRef.current &&
        selectedUser
      ) {
        wsRef.current.send(
          JSON.stringify({
            type: "typing",
            data: { to: selectedUser.id, stop: true },
          })
        );
        wasTypingRef.current = false;
      }
    };

    // if you leave the tab/window
    const vis = () => {
      if (document.hidden) stopNow();
    };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("pagehide", stopNow);

    // also fire on unmount or when switching users
    return () => {
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("pagehide", stopNow);
      stopNow();
    };
  }, [selectedUser?.id]);

  useEffect(() => {
    if (tab !== "direct" || !selectedUser || !wsRef.current) return;

    const trimmed = draft.trim();
    const now = Date.now();
    const THROTTLE_MS = 1200; // don’t send “typing” more often than this
    const DEBOUNCE_MS = 250; // small debounce so we don’t ping every keystroke

    const shouldPing =
      !!trimmed && now - lastTypingSentRef.current > THROTTLE_MS;

    const t = setTimeout(() => {
      if (shouldPing && wsRef.current?.readyState === WebSocket.OPEN) {
        lastTypingSentRef.current = Date.now();
        wsRef.current.send(
          JSON.stringify({ type: "typing", data: { to: selectedUser.id } })
        );
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [draft, tab, selectedUser?.id]);
  useEffect(() => {
    if (tab !== "direct" || !selectedUser || !wsRef.current) return;
    const isTyping = !!draft.trim();

    // if you were typing and now you're not → tell peer to stop immediately
    if (
      wasTypingRef.current &&
      !isTyping &&
      wsRef.current.readyState === WebSocket.OPEN
    ) {
      wsRef.current.send(
        JSON.stringify({
          type: "typing",
          data: { to: selectedUser.id, stop: true },
        })
      );
    }

    wasTypingRef.current = isTyping;
  }, [draft, tab, selectedUser?.id]);

  /** scroll to bottom on message change */
  // Scroll container + stickiness state
  const listRef = useRef<HTMLDivElement | null>(null);
  const [stickTyping, setStickTyping] = useState(true);
  const convKey =
    tab === "direct"
      ? `u:${selectedUser?.id ?? ""}`
      : `g:${selectedGroup?.id ?? ""}`;

  const prevCountRef = useRef<Record<string, number>>({});
  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  // On tab/conversation change: jump to bottom immediately
  useEffect(() => {
    scrollToBottom("auto");
  }, [tab, selectedUser?.id, selectedGroup?.id]);

  // When messages change: if we're already near bottom, follow smoothly
  // When messages change: first load of a convo → jump; otherwise follow only if near bottom
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const prev = prevCountRef.current[convKey] ?? 0;
    const curr = activeMsgs.length;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;

    if (curr > prev && (prev === 0 || nearBottom)) {
      scrollToBottom(prev === 0 ? "auto" : "smooth");
    }
    prevCountRef.current[convKey] = curr;
  }, [activeMsgs.length, convKey]);

  /** emoji picker */
  const commonEmojis = [
    "😀",
    "😁",
    "😂",
    "🤣",
    "😊",
    "😍",
    "😎",
    "🤩",
    "😇",
    "😉",
    "👍",
    "🙏",
    "🔥",
    "🎉",
    "💯",
    "❤️",
    "🫶",
    "👏",
    "😅",
    "🤝",
    "🤗",
    "😴",
    "🌙",
    "☕",
    "🍕",
    "🍩",
    "⚽",
    "🏆",
    "🎧",
    "💡",
    "✨",
    "🚀",
  ];
  const useEmoji = (e: string) => {
    setDraft((d) => d + (d && !d.endsWith(" ") ? " " + e : e));
    setShowEmoji(false);
    setRecentEmojis((prev) => {
      const next = [e, ...prev.filter((x) => x !== e)];
      return next.slice(0, 12);
    });
  };

  /** initials + avatars */
  const initials = (name: string) => (name?.trim()?.[0] || "?").toUpperCase();

  useEffect(() => {
    if (showCreateGroup) {
      fetchUsersForInvite();
    }
  }, [showCreateGroup]);

  const fetchUsersForInvite = async () => {
    try {
      const res = await fetch("/api/group/initial-invite", {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setUsersForInvite(data.users);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!validateForm()) {
      return;
    }

    const formData = new URLSearchParams();

    formData.append("title", groupForm.title);
    formData.append("description", groupForm.description);
    formData.append("members", JSON.stringify(groupForm.members));

    try {
      const res = await fetch("/api/group/create-group", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        // alert("Group created successfully!");
        toast.success("Group created successfully!");
        setGroupForm({ title: "", description: "", members: [] }); //reset the group data after creating the group
        setSelectedGroupUsers([]);
        setShowCreateGroup(false);
        // add func to refetch groups here
      }
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Error creating group");
      // alert("Error creating group"); //make pretty!
    } finally {
      setLoading(false);
    }
  };

  const handleStartCreateGroup = () => {
    setGroupsViewMode("create");
    setShowCreateGroup(true);
    setShowAllGroups(false);
    setGroupCreationStep("form");
    setGroupForm({ title: "", description: "", members: [] });
    setTempselectedGroupUsers([]);
  };

  const handleViewModeChange = (mode: "browse" | "panel" | "create") => {
    setGroupsViewMode(mode);
    if (mode === "browse") {
      setShowAllGroups(true);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGroupForm((prev) => ({ ...prev, title: e.target.value }));
  };

  const handleDescriptionChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setGroupForm((prev) => ({ ...prev, description: e.target.value }));
  };

  const toggleUserSelection = (user: User) => {
    //if user is creator himself, remove from list
    if (selectedGroupUsers.some((u) => u.id === user.id)) {
      setSelectedGroupUsers((prev) => prev.filter((u) => u.id !== user.id));
      setGroupForm((prev) => ({
        ...prev,
        members: prev.members.filter((id) => id !== user.id),
      }));
    } else {
      setSelectedGroupUsers((prev) => [...prev, user]);
      setGroupForm((prev) => ({
        ...prev,
        members: [...prev.members, user.id],
      }));
    }
  };

  const validateForm = () => {
    const errors: {
      title?: string;
      description?: string;
      members?: string;
    } = {};

    if (!groupForm.title.trim()) {
      errors.title = "Group title is required";
    } else if (groupForm.title.length > MAX_GROUP_TITLE_LENGTH) {
      errors.title = `Title must be ${MAX_GROUP_TITLE_LENGTH} characters or less`;
    }

    if (!groupForm.description.trim()) {
      errors.description = "Description is required";
    } else if (groupForm.description.length > MAX_GROUP_DESCRIPTION_LENGTH) {
      errors.description = `Description must be ${MAX_GROUP_DESCRIPTION_LENGTH} characters or less`;
    }

    if (groupForm.members.length === 0) {
      errors.members = "At least one member is required";
    } else if (groupForm.members.length > MAX_GROUP_MEMBERS) {
      errors.members = `Maximum ${MAX_GROUP_MEMBERS} members allowed`;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleGroupHeaderClick = (group: Group) => {
    setSelectedGroupForInfo(group);
    setShowGroupInfo(true);
  };

  const handleCloseGroupInfo = () => {
    setShowGroupInfo(false);
    setSelectedGroupForInfo(null);
  };

  const handleLeaveGroup = async (groupId: string | number) => {
    try {
      const res = await fetch(`/api/group/leave-group?group_id=${String(groupId)}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok) {
        handleCloseGroupInfo();
        fetchAllGroups();

        //if user was viewing the group they just left, clear the group select
        if (selectedGroup?.id === groupId) {
          setSelectedGroup(null);
        }
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to leave group");
      }
    } catch (error) {
      console.error("Error leaving group:", error);
    }
  };

  const handleDeleteGroup = async (groupId: string | number) => {
    if (
      !confirm(
        "Are you sure you want to delete this group? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/group/delete-group?group_id=${String(groupId)}`, {
        method: "DELETE",
        credentials: "include",
      });

      console.log("delete group res: ", res.status);

      if (res.ok) {
        const data = await res.json();
        console.log("Delete group res data: ", data);

        if (data.ok) {
          handleCloseGroupInfo();
          // Successfully deleted the group
          fetchAllGroups();
        }

        //if user was viewing the group they just left, clear the group select
        if (selectedGroup?.id === groupId) {
          setSelectedGroup(null);
        }
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to delete group");
        // alert(errorData.error || "Failed to delete group");
      }
    } catch (error) {
      console.error("Error deleting group:", error);
    }
  };

  const sendGroupMessage = () => {
    const text = draft.trim();
    if (!text || !selectedGroup || !meId) return;
    if (text.length > MAX_MESSAGE_LENGTH) {
      toast.error(`Message is too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`);
      return;
    }
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // Clear typing indicator
    setGroupTypingPeers((prev) => {
      const newState = { ...prev };
      const gid = String(selectedGroup.id);
      if (newState[gid]) {
        const filteredSet = new Set<string>();
        newState[selectedGroup.id].forEach((id) => {
          if (id !== meId) {
            filteredSet.add(id);
          }
        });
        newState[selectedGroup.id] = filteredSet;
      }
      return newState;
    });

    // Send stop typing message
    wsRef.current.send(
      JSON.stringify({
        type: "group_typing",
        data: { group_id: selectedGroup.id, stop: true },
      })
    );

    const clientId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    // Send group message
    wsRef.current.send(JSON.stringify({
      type: "group_message",
      data: { groupId: String(selectedGroup.id), group_id: String(selectedGroup.id), text, clientId },
    }))

    setDraft("");
    setShowEmoji(false);
  };

  const fetchGroupMessages = async (controller: AbortController, groupId: string) => {

    try {
      const r = await fetch(
        `/api/group/messages?group_id=${encodeURIComponent(groupId)}`,
        { credentials: 'include', signal: controller.signal }
      )
      if (!r.ok) {
        console.log('Failed to fetch group messages:', r.status);
        return
      }

      const data = await r.json().catch(() => [])

      if (data.ok && Array.isArray(data.messages)) {
        const rows = data.messages;

        type GroupMessagesType = {
          id: string;
          sender_id: string;
          group_id: string;
          content: string;
          sent_at: string;
          firstName?: string;
          lastName?: string;
          nickname?: string;
          avatar?: string;
        }

        setMsgsByGroup(prev => ({
          ...prev,
          [groupId]: rows.map((x: GroupMessagesType) => ({
            id: x.id,
            from: x.sender_id,
            groupId: x.group_id,
            text: x.content,
            ts: x.sent_at,
            seen: false,
            firstName: x.firstName,
            lastName: x.lastName,
            nickname: x.nickname,
            avatar: x.avatar
          }))
        }))
      } else {
        console.error('Invalid response format from group messages API')
        setMsgsByGroup(prev => ({
          ...prev,
          [groupId]: []
        }));
      }


    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Failed to fetch group messages:', err)
      }
    }
  }

  useEffect(() => {
    if (tab !== "groups" || !selectedGroup?.id || !meId) return;

    const controller = new AbortController();
    const groupId = String(selectedGroup.id);

    // Check if user is a member of the group
    if (!selectedGroup.is_member) {
      console.log("not a member");
      return;
    }

    fetchGroupMessages(controller, groupId)
    return () => controller.abort()
  }, [tab, selectedGroup?.id, meId, groupTab])

  const fetchGroupMembers = async (groupId: string, isMember: boolean) => {
    const gid = String(groupId);

    // Check if user is a member of the group
    if (!isMember) {
      console.log("not a member");
      return;
    }
    try {
      const res = await fetch(`/api/group/members?group_id=${encodeURIComponent(gid)}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();

        const membersWithName = (data.members || []).map((member: any) => ({
          id: member.id,
          name:
            member.name ||
            `${member.firstName || ""} ${member.lastName || ""}`.trim() ||
            member.nickname ||
            member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          nickname: member.nickname,
          avatar: member.avatar,
        }));

        setGroupMembers((prev) => ({
          ...prev,
          [gid]: membersWithName,
        }));
      }

    } catch (error) {
      console.error("Failed to fetch group members:", error);
    }
  };

  // fetch group members when a group is selected
  useEffect(() => {
    if (tab === "groups" && selectedGroup) {
      const gid = String(selectedGroup.id);
      if (!groupMembers[gid]) fetchGroupMembers(gid, selectedGroup.is_member);
    }
  }, [tab, selectedGroup?.id, groupMembers, selectedGroup?.is_member, activeMsgs]);


  /** ---------- Render ---------- **/
  if (!me || !me.id) {
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
            <title>Messages</title>
          </Head>
    <div className="m-0 p-0 bg-[#0a0a0a] text-white overflow-x-hidden min-h-[100vh] relative">
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

      {/* NAVBAR */}
      <Navbar user={me} />

      {/* ======= Page ======= */}
      <div className="relative min-h-[100vh] z-[1] pt-28 pb-10 px-4">
        <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-[360px_1fr] gap-4 md:gap-6">
          {/* LEFT: People / Groups */}
          <aside
            className={`${mobileView === "chat" ? "hidden" : ""} relative rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,#181818,#151515)] shadow-[0_0_8px_rgba(0,255,255,0.15),0_0_18px_rgba(255,0,255,0.12)]  h-[70vh] overflow-hidden`}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl"
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
            {/* Tabs + Search */}
            <div className="p-3 border-b border-[rgba(255,255,255,.08)]">
              <div className="flex gap-1 mb-3">
                <button
                  onClick={() => setTab("direct")}
                  className={cls(
                    "px-3 py-1.5 rounded-xl text-sm border transition",
                    tab === "direct"
                      ? "bg-[#1b1b1b] border-[rgba(0,255,255,.35)] shadow-[0_0_12px_rgba(0,255,255,.25)]"
                      : "bg-[#191919] border-[rgba(255,255,255,0.08)] hover:border-[rgba(0,255,255,0.35)]"
                  )}
                >
                  Direct
                </button>
                <button
                  onClick={() => setTab("groups")}
                  className={cls(
                    "px-3 py-1.5 rounded-xl text-sm border transition",
                    tab === "groups"
                      ? "bg-[#1b1b1b] border-[rgba(255,0,255,.35)] shadow-[0_0_12px_rgba(255,0,255,.25)]"
                      : "bg-[#191919] border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,0,255,0.35)]"
                  )}
                >
                  Groups
                </button>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.12)] backdrop-blur-[6px] w-full">
                <Search className="w-5 h-5 text-[#aab9c2]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    tab === "direct" ? "Search people…" : "Search groups…"
                  }
                  className="bg-transparent border-0 outline-none text-white w-full placeholder:text-[#aab9c2]"
                />
              </div>
            </div>

            <div
              className={cls(
                "h-[calc(70vh-6.65rem)] mb-4 p-2 pr-3",
                tab === "direct" ? "overflow-y-auto" : "overflow-hidden"
              )}
            >
              {tab === "direct" &&
                sortedUsers.map((u) => {
                  const isOnline = !!onlineMap[u.id];
                  const last = (msgsByUser[u.id] || []).slice(-1)[0];
                  const active = selectedUser?.id === u.id;
                  const lock = !canDM(u);
                  const rel = relFor(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => {
                        setSelectedUser(u);
                        setSelectedGroup(null);
                        if (window.innerWidth < 768) setMobileView("chat");
                      }}
                      className={cls(
                        "w-full text-left grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2.5 rounded-[12px] border transition mb-2",
                        active
                          ? "bg-[#1b1b1b] border-[rgba(0,255,255,.35)] shadow-[0_0_12px_rgba(0,255,255,.25)]"
                          : "bg-[#191919] border-[rgba(255,255,255,0.08)] hover:-translate-y-[1px] hover:border-[rgba(0,255,255,0.35)] hover:bg-[#1c1c1c]"
                      )}
                    >
                      <div className="relative">
                        <Avatar
                          user={u}
                          size={10}
                          className="shadow-[0_0_10px_rgba(0,255,255,.25)] border border-[rgba(255,255,255,0.08)]"
                        />
                        <span
                          className={cls(
                            "absolute -right-1 -bottom-1 w-3 h-3 rounded-full border border-black",
                            !!onlineMap[u.id]
                              ? "bg-emerald-400 animate-pulse"
                              : "bg-gray-500"
                          )}
                          aria-label={!!onlineMap[u.id] ? "Online" : "Offline"}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="font-semibold truncate flex items-center gap-2">
                          <div
                            className="font-semibold truncate flex items-center gap-2 hover:text-[#aaccff]"
                            onClick={(e) => {
                              e.preventDefault();
                              handleProfileClick(u.id);
                            }}
                          >
                            {u.name}
                          </div>
                          {u.isPublic && (
                            <span className="text-[10px] px-1.5 py-[1px] rounded-full border border-[rgba(0,255,255,.35)] text-[#cfe]">
                              Public
                            </span>
                          )}
                          {/* Hide Locked chip when UNLOCK_ALL */}
                          {!UNLOCK_ALL && lock && (
                            <span
                              title="to message a user, either follow them or they follow you, or user has public profile"
                              className="text-[10px] px-1 py-[1px] text-[rgba(255,0,55,0.77)]"
                            >
                              <Lock className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#aab] truncate">
                          {last
                            ? (last.from === meId ? "You: " : "") + last.text
                            : ""}
                        </div>
                        {rel && (
                          <div className="text-[10px] text-[#8aa] mt-0.5">
                            {rel.iFollow ? "You follow" : ""}
                            {rel.iFollow && rel.followsMe ? " · " : ""}
                            {rel.followsMe ? "Follows you" : ""}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}

              {tab === "groups" && (
                <div className="h-[calc(70vh-92px)] flex flex-col">
                  {/*header with icons */}
                  <GroupHeader
                    groupsViewMode={groupsViewMode}
                    onViewModeChange={handleViewModeChange}
                    onCreateGroup={handleStartCreateGroup}
                  />

                  {/* Content area that changes based on view mode */}
                  <div className="flex-1 overflow-y-auto p-3 mb-10">
                    {groupsViewMode === "browse" && (
                      <div className="space-y-2">
                        {filteredGroups.length > 0 ? (
                          filteredGroups.map((g) => {
                            const last = (msgsByGroup[g.id] || []).slice(-1)[0];
                            const active = selectedGroup?.id === g.id;
                            const isLocked = !g.is_member;

                            return (
                              <button
                                key={g.id}
                                onClick={() => {
                                  setSelectedGroup(g);
                                  setSelectedUser(null);
                                  if (window.innerWidth < 768) setMobileView("chat")
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  handleGroupHeaderClick(g);
                                }}
                                className={cls(
                                  "w-full text-left grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2.5 rounded-[12px] border transition",
                                  active
                                    ? "bg-[#1b1b1b] border-[rgba(255,0,255,.35)] shadow-[0_0_12px_rgba(255,0,255,.25)]"
                                    : "bg-[#191919] border-[rgba(255,255,255,0.08)] hover:-translate-y-[1px] hover:border-[rgba(255,0,255,0.35)] hover:bg-[#1c1c1c]"
                                )}
                              >
                                <div className="relative">
                                  <div
                                    className="grid place-items-center rounded-full font-bold uppercase text-black w-[42px] h-[42px] text-[0.95rem] shadow-[0_0_10px_rgba(255,0,255,.25)]"
                                    style={{
                                      background:
                                        "radial-gradient(circle at 30% 30%, #ff66ff, #ffb3ff), #ff66ff",
                                    }}
                                  >
                                    {initials(g.title)}
                                  </div>
                                  {/* {!!g.unread && (
                                    <span className="absolute -right-2 -bottom-2 text-[10px] px-1.5 py-[1px] rounded-full bg-[rgba(255,0,255,.18)] border border-[rgba(255,0,255,.35)]">
                                      {g.unread}
                                    </span>
                                  )} */}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold truncate flex items-center gap-2">
                                    {g.title}
                                    {isLocked && (
                                      <span
                                        title="Join this group to participate"
                                        className="text-[10px] px-1 py-[1px] text-[rgba(255,0,55,0.77)] flex items-center gap-1"
                                      >
                                        <Lock className="w-4 h-4" />
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-[#aab] truncate">
                                    {last
                                      ? (last.from === meId ? "You: " : "") +
                                      last.text
                                      : ""}
                                  </div>
                                  <div className="text-[10px] text-[#8aa] mt-0.5">
                                    {g.member_count} member
                                    {g.member_count !== 1 ? "s" : ""}
                                  </div>
                                </div>
                                <div className="text-[11px] text-[#8aa]">
                                  {last ? relTime(last.ts) : ""}
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="text-[#9aa] px-3 py-4 text-center">
                            {query ? "No groups found" : "No groups yet. Create your first group!"}
                          </div>
                        )}
                      </div>
                    )}

                    {groupsViewMode === "panel" && (
                      <GroupPanel
                        onInviteAccepted={fetchAllGroups}
                        onRequestAccepted={fetchAllGroups}
                      />
                    )}

                    {groupsViewMode === "create" && (
                      <>
                        {groupCreationStep === "members" ? (
                          <MembersSelection
                            usersForInvite={filteredUsersForInvite}
                            tempselectedGroupUsers={tempselectedGroupUsers}
                            query={inviteQuery}
                            onQueryChange={setinviteQuery}
                            onToggleUser={(user) => {
                              if (
                                tempselectedGroupUsers.some(
                                  (u) => u.id === user.id
                                )
                              ) {
                                setTempselectedGroupUsers((prev) =>
                                  prev.filter((u) => u.id !== user.id)
                                );
                              } else {
                                setTempselectedGroupUsers((prev) => [
                                  ...prev,
                                  user,
                                ]);
                              }
                            }}
                            onBack={() => setGroupCreationStep("form")}
                            onDone={() => {
                              setSelectedGroupUsers(tempselectedGroupUsers);
                              setGroupForm((prev) => ({
                                ...prev,
                                members: tempselectedGroupUsers.map(
                                  (u) => u.id
                                ),
                              }));
                              setGroupCreationStep("form");
                            }}
                            maxMembers={MAX_GROUP_MEMBERS}
                          />
                        ) : (
                          //form step
                          <GroupForm
                            groupForm={groupForm}
                            selectedGroupUsers={selectedGroupUsers}
                            validationErrors={validationErrors}
                            loading={loading}
                            onTitleChange={handleTitleChange}
                            onDescriptionChange={handleDescriptionChange}
                            onSelectMembers={() => {
                              setTempselectedGroupUsers(selectedGroupUsers);
                              setGroupCreationStep("members");
                              setValidationErrors((prev) => ({
                                ...prev,
                                members: undefined,
                              }));
                            }}
                            onSubmit={handleCreateGroup}
                            maxTitleLength={MAX_GROUP_TITLE_LENGTH}
                            maxDescriptionLength={MAX_GROUP_DESCRIPTION_LENGTH}
                            maxMembers={MAX_GROUP_MEMBERS}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {tab === "direct" && sortedUsers.length === 0 && (
                <div className="text-[#9aa] px-3 py-4">No results.</div>
              )}
            </div>
          </aside>

          {/* RIGHT: Conversation */}
          <section
            className={`${mobileView === "list" ? "hidden" : ""} relative rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,#181818,#151515)] shadow-[0_0_8px_rgba(0,255,255,0.15),0_0_18px_rgba(255,0,255,0.12)] h-[70vh] overflow-hidden flex flex-col`}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl"
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

            {/* Header */}
            <div className="flex items-center justify-between gap-3 p-4 border-b border-[rgba(255,255,255,.08)]">
              {tab === "direct" && selectedUser && (
                <>
                  {mobileView === "chat" && (
                    <button
                      onClick={() => setMobileView("list")}
                      className="md:hidden z-50 translate-y-16 absolute mr-2 px-3 py-1.5 rounded-xl bg-[#191919] border border-white/10 text-sm text-white hover:bg-[#222]"
                    >
                      ← Back
                    </button>
                  )}
                  <div className="flex items-center gap-3">
                    <Avatar
                      user={selectedUser}
                      size={10}
                      className="shadow-[0_0_10px_rgba(0,255,255,.25)] border border-[rgba(255,255,255,0.08)]"
                    />

                    <div>
                      <div className="font-bold flex items-center gap-2">
                        <div
                          className="font-semibold truncate flex items-center gap-2 hover:text-[#aaccff]"
                          onClick={(e) => {
                            e.preventDefault();
                            handleProfileClick(selectedUser.id);
                          }}
                        >
                          {selectedUser.name}
                        </div>

                        {selectedUser.isPublic && (
                          <span className="text-[10px] px-1.5 py-[1px] rounded-full border border-[rgba(0,255,255,.35)] text-[#cfe]">
                            Public
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#9aa]">
                        {typingPeers[selectedUser.id] ? (
                          <span className="inline-flex items-center gap-1 align-middle">
                            <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce"></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:120ms]"></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce [animation-delay:240ms]"></span>
                            <span className="ml-1">typing…</span>
                          </span>
                        ) : onlineMap[selectedUser.id] ? (
                          "Online"
                        ) : (
                          "Offline"
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    className={cls(
                      "text-xs",
                      UNLOCK_ALL ||
                        selectedUser.isPublic ||
                        relFor(selectedUser.id)?.followsMe
                        ? "text-emerald-300"
                        : "text-[#9aa]"
                    )}
                  >
                    {instantDeliveryMsg(selectedUser)}
                  </div>
                </>
              )}

              {tab === "groups" && selectedGroup && (
                <>
                  <div
                    role="button"
                    tabIndex={0}
                    className="flex w-full items-center justify-between gap-3 py-2 cursor-pointer"
                    onClick={() => handleGroupHeaderClick(selectedGroup)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleGroupHeaderClick(selectedGroup);
                      }
                    }}
                    title="group info"
                  >
                    {mobileView === "chat" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMobileView("list");
                        }}
                        className="md:hidden mr-2 z-50 translate-y-20 absolute px-3 py-1.5 rounded-xl bg-[#191919] border border-white/10 text-sm text-white hover:bg-[#222]"
                      >
                        ← Back
                      </button>
                    )}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="grid place-items-center rounded-full font-bold uppercase text-black w-[44px] h-[44px] text-[1rem] shadow-[0_0_10px_rgba(255,0,255,.25)] shrink-0"
                        style={{
                          background:
                            "radial-gradient(circle at 30% 30%, #ff66ff, #ffb3ff), #ff66ff",
                        }}
                      >
                        {initials(selectedGroup.title)}
                      </div>

                      <div className="flex flex-col items-start min-w-0">
                        <div className="font-bold">{selectedGroup.title}</div>
                        <div className="text-xs text-[#9aa]">
                          {selectedGroup.member_count} member
                          {selectedGroup.member_count !== 1 ? "s" : ""} · Shared
                          room
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tabs */}
                  {selectedGroup.is_member ? (
                    <div className="mt-1">
                      <div
                        role="tablist"
                        aria-label="Group sections"
                        className="flex flex-wrap sm:flex-nowrap gap-2 gap-y-2 border-b border-white/10"
                      >

                        {TABS.map((t) => {
                          const active = groupTab === t;
                          return (
                            <button
                              key={t}
                              role="tab"
                              aria-selected={active}
                              aria-controls={`group-${t}-panel`}
                              tabIndex={active ? 0 : -1}
                              onClick={() => setGroupTab(t)}
                              className={[
                                "relative px-3 py-2 text-sm capitalize rounded-t-md transition",
                                "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-fuchsia-400/60",
                                active
                                  ? "font-semibold text-white"
                                  : "text-[#aab] hover:text-white",
                              ].join(" ")}
                            >
                              <span className="flex items-center gap-1.5">
                                {t}
                              </span>

                              <span
                                className={[
                                  "pointer-events-none absolute left-0 right-0 -bottom-px h-[2px]",
                                  active
                                    ? "bg-gradient-to-r from-fuchsia-400/90 via-pink-400/90 to-fuchsia-400/90 shadow-[0_0_12px_rgba(255,0,255,.35)]"
                                    : "bg-transparent",
                                ].join(" ")}
                              />
                            </button>
                          );
                        })}

                        {/* pushes tabs left, keeps bottom border clean */}
                        <div className="flex-1" />
                      </div>

                      {/* Panels */}
                      <div className="pt-3">
                        {groupTab === 'posts' && (
                          <div id="group-posts-panel" role="tabpanel" aria-labelledby="posts">
                            {/* render posts here */}
                          </div>
                        )}
                        {groupTab === 'events' && (
                          <div id="group-events-panel" role="tabpanel" aria-labelledby="events">
                            {/* <EventsList
                                                    groupId={selectedGroup?.id || ''} 
                                                    isGroupMember={selectedGroup?.is_member || false}
                                                    /> */}
                          </div>
                        )}
                        {groupTab === 'chat' && (
                          <div id="group-events-panel" role="tabpanel" aria-labelledby="chat">
                            {/* render chats here */}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    ""
                  )}
                </>
              )}

              {!selectedUser && !selectedGroup && (
                <div className="text-[#9aa]">Select a conversation</div>
              )}
            </div>

            {/* Messages with date separators */}
            <div
              ref={listRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                const nearBottom =
                  el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                setStickTyping(nearBottom);
              }}
              className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-6 space-y-3 pb-14"
            >
              {(tab === "direct" ||
                (tab === "groups" && groupTab === "chat")) && (
                  <>
                    {activeMsgs.length === 0 && (
                      <div className="text-[#9aa] mt-10 text-center">
                        Nothing for you to see.
                      </div>
                    )}

                    {activeMsgs.length > 0 && (
                      <MessagesList
                        messages={activeMsgs}
                        users={tab === 'direct' ? users : (groupMembers[String(selectedGroup?.id ?? '')] || [])}
                        meId={meId}
                        isGroup={tab === 'groups'}
                        onUserClick={handleProfileClick}
                      // onNewUser={fetchGroupMembers(String(selectedGroup?.id || ''), true)}
                      // fetchMsgs={fetchGroupMessages(new AbortController,String(selectedGroup?.id || ''))}
                      />
                    )}
                  </>
                )}
              {(tab === 'groups' && selectedGroup && groupTab === 'posts' && selectedGroup.is_member) ? (
                <div className="p-2 mt-10">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Group Posts
                    </h2>

                    <button
                      onClick={() => setShowCreatePostModal(true)}
                      title='create post'
                      className="flex items-center gap-2 px-2 py-1 text-base text-white rounded-lg border bg-[#1b1b1b] border-[rgba(255,0,255,.35)]"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Posts list */}
                  <PostsList groupId={Number(selectedGroup.id)} pageSize={10} refreshKey={postsRefreshKey} />

                  {/* Create post modal */}
                  <CreatePostModal
                    isOpen={showCreatePostModal}
                    onClose={() => setShowCreatePostModal(false)}
                    onSubmit={submitCreatePost}
                    loading={posting}
                  />
                </div>
              ) : null}
              {(tab === 'groups' && selectedGroup && groupTab === 'events' && selectedGroup.is_member) ? (
                <div className="text-[#9aa] mt-10 text-center">
                  <EventsList
                    groupId={String(selectedGroup?.id ?? '')}
                    isGroupMember={!!selectedGroup?.is_member}
                    refreshKey={eventsRefreshKeyByGroup[String(selectedGroup?.id ?? '')] || 0}
                  />

                </div>
              ) : null}


              {selectedUser && typingPeers[selectedUser.id] && (
                <div
                  className={cls(
                    stickTyping
                      ? "sticky bottom-0 z-10 pt-2 pb-1 bg-transparent pointer-events-none"
                      : "mt-2"
                  )}
                >
                </div>
              )}

              {/* <div ref={bottomRef} /> */}
            </div>

            {/* Composer */}
            {((tab === "direct" && selectedUser) ||
              (tab === "groups" && selectedGroup && groupTab === "chat")) && (
                <div className="p-3 md:p-4 border-t border-[rgba(255,255,255,.08)]">
                  {tab === "direct" && selectedUser && !canDM(selectedUser) && (
                    <div className="flex gap-2 items-center mb-2 text-[12px] px-3 py-2 rounded-xl bg-[rgba(255,99,71,.08)] border border-[rgba(255,99,71,.35)] text-[#ffd6d6]">
                      <Lock className="w-3 h-3" />
                      You can’t message this user. You must follow them or they
                      must follow you
                    </div>
                  )}
                  {tab === "groups" &&
                    selectedGroup &&
                    !selectedGroup.is_member && (
                      <div className="flex gap-2 items-center mb-2 text-[12px] px-3 py-2 rounded-xl bg-[rgba(255,99,71,.08)] border border-[rgba(255,99,71,.35)] text-[#ffd6d6]">
                        <Lock className="w-3 h-3" /> Join this group to
                        participate.
                      </div>
                    )}

                  <div className="flex items-end gap-2">
                    {/* Emoji */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowEmoji((v) => !v)}
                        className="px-3 py-2 rounded-xl bg-[#232323] border border-[rgba(255,255,255,.12)] hover:border-[rgba(0,255,255,.35)] hover:-translate-y-[1px] transition"
                        title="Emoji"
                      >
                        😊
                      </button>
                      {showEmoji && (
                        <div className="absolute bottom-12 left-0 z-20 w-[280px] p-2 rounded-2xl bg-[#141414] border border-[rgba(255,255,255,.12)] shadow-[0_10px_30px_rgba(0,0,0,.5)]">
                          {recentEmojis.length > 0 && (
                            <>
                              <div className="text-[11px] text-[#8aa] px-1 mb-1">
                                Recent
                              </div>
                              <div className="grid grid-cols-8 gap-1.5 mb-2">
                                {recentEmojis.map((e) => (
                                  <button
                                    key={`r-${e}`}
                                    onClick={() => useEmoji(e)}
                                    className="text-xl hover:scale-110 transition"
                                  >
                                    {e}
                                  </button>
                                ))}
                              </div>
                              <div className="h-px bg-white/10 my-1" />
                            </>
                          )}
                          <div className="text-[11px] text-[#8aa] px-1 mb-1">
                            Popular
                          </div>
                          <div className="grid grid-cols-8 gap-1.5">
                            {commonEmojis.map((e) => (
                              <button
                                key={e}
                                onClick={() => useEmoji(e)}
                                className="text-xl hover:scale-110 transition"
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Textarea */}
                    <textarea
                      disabled={
                        (tab === "direct" &&
                          (!selectedUser || !canDM(selectedUser))) ||
                        (tab === "groups" &&
                          (!selectedGroup || !selectedGroup.is_member))
                      }
                      value={draft}
                      onChange={(e) => {
                        if (e.target.value.length <= MAX_MESSAGE_LENGTH) {
                          setDraft(e.target.value);
                        }
                      }}
                      onBlur={() => {
                        if (
                          wsRef.current?.readyState === WebSocket.OPEN &&
                          wasTypingRef.current &&
                          selectedUser
                        ) {
                          wsRef.current.send(
                            JSON.stringify({
                              type: "typing",
                              data: { to: selectedUser.id, stop: true },
                            })
                          );
                          wasTypingRef.current = false;
                        }
                      }}
                      placeholder={
                        tab === "direct"
                          ? selectedUser
                            ? `Message ${selectedUser.name}…`
                            : "Select a conversation"
                          : selectedGroup
                            ? `Message ${selectedGroup.title}…`
                            : "Select a group"
                      }
                      rows={2}
                      className="flex-1 h-[44px] bg-[#232323] text-white border border-[#444] rounded-xl px-3 py-2 resize-none overflow-y-auto placeholder:text-[#9aa] disabled:opacity-60"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                    />

                    {/*Character counter */}
                    <div
                      className={cls(
                        "absolute bottom-2 right-2 text-xs pointer-events-none",
                        draft.length > MAX_MESSAGE_LENGTH
                          ? "text-red-400"
                          : draft.length > WARNING_THRESHOLD
                            ? "text-yellow-400"
                            : "text-[#8aa]"
                      )}
                    >
                      {draft.length}/{MAX_MESSAGE_LENGTH}
                    </div>

                    {/* Send */}
                    <button
                      type="button"
                      onClick={send}
                      disabled={
                        !draft.trim() ||
                        draft.length > MAX_MESSAGE_LENGTH ||
                        (tab === "direct" &&
                          (!selectedUser || !canDM(selectedUser))) ||
                        (tab === "groups" &&
                          (!selectedGroup || !selectedGroup.is_member))
                      }
                      className="px-4 py-2.5 rounded-xl font-semibold bg-[#232323] text-[#eee] border border-[rgba(255,255,255,0.12)] hover:border-[rgba(0,255,255,.35)] hover:-translate-y-[1px] transition disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>

                  <div className="text-[11px] text-[#8aa] mt-1 pl-11">
                    Press <b>Enter</b> to send · <b>Shift+Enter</b> for new line
                  </div>
                </div>
              )}
          </section>
          {ViewingProfile && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/70"
              onClick={() => setViewingProfile(null)}
            >
              <div
                className="relative w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="absolute -top-10 -right-7 text-white hover:trxt-gray-300 text-2xl transition-colors"
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
        </div>
      </div>

      {/* keyframes */}
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
      `}</style>

      {showGroupInfo && selectedGroupForInfo && (
        <GroupInfo
          group={{
            id: selectedGroupForInfo.id,
            title: selectedGroupForInfo.title,
            description: selectedGroupForInfo.description,
            member_count: selectedGroupForInfo.member_count,
            is_member: selectedGroupForInfo.is_member,
            is_creator: String(selectedGroupForInfo.creator_id) === String(meId),
          }}
          onClose={handleCloseGroupInfo}
          onLeaveGroup={handleLeaveGroup}
          onDeleteGroup={handleDeleteGroup}
        />

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
      {/* Group typing indicator */}
      {tab === "groups" &&
        selectedGroup &&
        groupTab === "chat" &&
        groupTypingPeers[String(selectedGroup.id)]?.size > 0 && (
          <div
            className={`flex justify-start ${stickTyping ? "sticky bottom-0 z-10 pt-2 pb-1 bg-transparent" : "mt-2"}`}
          >
            <div className="rounded-[14px] px-3.5 py-2.5 border bg-[#1f1b21] border-[rgba(255,0,255,.28)] shadow-[0_0_14px_rgba(255,0,255,.16)] text-[0.95rem] leading-[1.35]">
              <span className="inline-flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:120ms]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce [animation-delay:240ms]"></span>
              </span>
              <span className="ml-2 text-[#cfe] opacity-80">
                {Array.from(groupTypingPeers[String(selectedGroup.id)] || [])
                  .map((userId) => {
                    const user = groupMembers[String(selectedGroup.id)]?.find((u) => u.id === userId);
                    return user ? user.name : userId;
                  })
                  .join(", ")}{" "}
                typing...
              </span>
            </div>
          </div>
        )}
    </div>
  </>);
}
}
