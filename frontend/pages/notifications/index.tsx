"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/navbar";

type Notif = {
  id: number;
  recipient_id: string;
  type: string;
  content: any;
  is_read: boolean;
  created_at: string;
};

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return `${Math.max(s, 1)}s`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);

  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const unread = useMemo(() => items.filter((x) => !x.is_read).length, [items]);

  useEffect(() => {
    (async () => {
      // load me
      const r = await fetch("/api/me", { credentials: "include" });
      if (!r.ok) {
        router.push("/login");
        return;
      }
      setMe(await r.json());

      // load notifications
      await loadFirst();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFirst() {
    setLoading(true);
    try {
      const r = await fetch("/api/notifications?limit=40", { credentials: "include" });
      const j = await r.json();
      setItems(j.items || []);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!items.length) return;
    const before = items[items.length - 1].id;
    const r = await fetch(`/api/notifications?limit=40&before=${before}`, { credentials: "include" });
    const j = await r.json();
    const more: Notif[] = j.items || [];
    if (!more.length) return;
    setItems((prev) => [...prev, ...more]);
  }

  async function markOneRead(id: number) {
    setBusyId(id);
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
        credentials: "include",
      });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", {
      method: "POST",
      credentials: "include",
    });
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  function openNotification(n: Notif) {
    // mark read first (UX: immediate)
    if (!n.is_read) markOneRead(n.id);

    // route based on type (same logic you already use in toast clicks)
    if (n.type === "dm") {
      const fromId = String(n.content?.from ?? "");
      if (fromId) localStorage.setItem("intent:openDM", fromId);
      router.push("/messages");
      return;
    }

    if (n.type === "follow_request") {
      localStorage.setItem("intent:openFollowRequests", "1");
      router.push(`/profile/${me?.id}`);
      return;
    }

    if (n.type === "group_invite") {
      const gid = String(n.content?.groupId ?? n.content?.groupID ?? n.content?.group_id ?? "");
      if (gid) localStorage.setItem("intent:groupId", gid);
      localStorage.setItem("intent:openGroupInvites", "1");
      router.push("/groups");
      return;
    }

    if (n.type === "group_event_created" || n.type === "group_request.created" || n.type === "group_request.update") {
      const gid = String(n.content?.groupId ?? n.content?.groupID ?? n.content?.group_id ?? "");
      if (gid) localStorage.setItem("intent:groupId", gid);
      localStorage.setItem("intent:openGroup", "1");
      router.push("/groups");
      return;
    }
  }

  if (!me) return null;

  return (
    <div className="min-h-screen bg-black">
      {/* neon bg */}
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

      <Navbar user={me} />

      <main className="relative z-10 max-w-4xl mx-auto px-4 pt-28 pb-10">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-white text-2xl font-extrabold">Notifications</h1>
            <p className="text-white/60 text-sm">
              {loading ? "Loading…" : `${unread} unread • ${items.length} total`}
            </p>
          </div>

          <button
            onClick={markAllRead}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm border border-white/10"
            disabled={!items.length || unread === 0}
          >
            Mark all as read
          </button>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
          {loading ? (
            <div className="p-10 text-white/70">Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-white/60">No notifications yet.</div>
          ) : (
            <ul className="divide-y divide-white/10">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={[
                    "p-4 flex items-start gap-3 cursor-pointer transition",
                    n.is_read ? "bg-transparent hover:bg-white/5" : "bg-white/10 hover:bg-white/15",
                  ].join(" ")}
                  onClick={() => openNotification(n)}
                >
                  <div
                    className={[
                      "mt-1 w-2.5 h-2.5 rounded-full",
                      n.is_read ? "bg-white/20" : "bg-cyan-300 shadow-[0_0_10px_rgba(0,255,255,.35)]",
                    ].join(" ")}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-white font-semibold truncate">
                        {n.type.replaceAll("_", " ")}
                      </div>
                      <div className="text-white/50 text-xs whitespace-nowrap">
                        {relTime(n.created_at)} • {new Date(n.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="text-white/70 text-sm mt-1 break-words">
                      {/* Best effort preview */}
                      {n.type === "dm"
                        ? `${n.content?.nickname ?? n.content?.firstName ?? "Someone"}: ${n.content?.text ?? ""}`
                        : JSON.stringify(n.content)}
                    </div>

                    {!n.is_read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markOneRead(n.id);
                        }}
                        disabled={busyId === n.id}
                        className="mt-2 text-xs px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/10"
                      >
                        {busyId === n.id ? "…" : "Mark read"}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={loadMore}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm border border-white/10"
            >
              Load more
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
