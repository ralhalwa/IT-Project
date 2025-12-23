"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut } from "lucide-react";
import Avatar from "./avatar";
import { User } from "@/types/user";

interface NavbarProps {
  user: User | null;
}

export default function Navbar({ user }: NavbarProps) {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [unread, setUnread] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const WS_PORT = 8080; // your backend port

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // initial count (on mount + when user changes)
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const r = await fetch("/api/notifications/unread-count", {
          credentials: "include",
        });
        if (r.ok) {
          const j = await r.json();
          setUnread(Number(j.count ?? 0));
        }
      } catch {
        /* ignore */
      }
    })();
  }, [user?.id]);

  // Option A: open WS inside Navbar & listen for badge.unread
  useEffect(() => {
    if (!user?.id) return;

    const connect = () => {
      // close previous if any
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }

      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const host = window.location.hostname;

      const ws = new WebSocket(`${proto}://${host}:${WS_PORT}/ws`);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          const env = JSON.parse(ev.data);

          // ✅ server pushes this when read / read-all (and should also push after insert)
          if (env.type === "badge.unread") {
            setUnread(Number(env.data?.count ?? 0));
            return;
          }

          // fallback: if you only send notification.created but not badge.unread on insert
          if (env.type === "notification.created") {
            fetch("/api/notifications/unread-count", { credentials: "include" })
              .then((r) => (r.ok ? r.json() : null))
              .then((j) => j && setUnread(Number(j.count ?? 0)))
              .catch(() => {});
          }
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        wsRef.current = null;

        // small auto-reconnect (helps if server restarts)
        if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, 800);
      };

      ws.onerror = () => {
        // will trigger onclose afterwards in most cases
      };
    };

    connect();

    return () => {
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    };
  }, [user?.id]);

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Logout failed");
      router.push("/login");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  if (!user) return null;

  return (
    <nav
      className={[
        "fixed top-5 left-1/2 -translate-x-1/2 rounded-full max-sm:px-4 px-8 py-4 flex items-center justify-between z-[1000] w-[90%] max-w-[900px] transition-all",
        scrolled
          ? "shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-[12px] bg-[rgba(30,30,30,0.8)] border border-[rgba(255,255,255,0.1)]"
          : "",
      ].join(" ")}
    >
      <div className="flex gap-8 max-sm:gap-4 items-center">
        <Link
          href="/"
          className="text-white no-underline text-[0.95rem] font-medium transition-all hover:[text-shadow:_0_0_4px_#00ffff,0_0_8px_#ff00ff,0_0_12px_#00ff99]"
          title="Home"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill="currentColor" viewBox="0 0 24 24">
            <path d="m12.71,2.29c-.39-.39-1.02-.39-1.41,0L3.29,10.29c-.19.19-.29.44-.29.71v9c0,1.1.9,2,2,2h4c.55,0,1-.45,1-1v-6h4v6c0,.55.45,1,1,1h4c1.1,0,2-.9,2-2v-9c0-.27-.11-.52-.29-.71L12.71,2.29Zm3.29,17.71v-5c0-1.1-.9-2-2-2h-4c-1.1,0-2,.9-2,2v5h-3v-8.59l7-7,7,7v8.59s-3,0-3,0Z" />
          </svg>
        </Link>

        <Link
          href="/messages"
          className="text-white no-underline text-[0.95rem] font-medium transition-all hover:[text-shadow:_0_0_4px_#00ffff,0_0_8px_#ff00ff,0_0_12px_#00ff99]"
          title="Messages"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 9H17V11H7z"></path>
            <path d="M7 13H14V15H7z"></path>
            <path d="m12,2C6.49,2,2,6.49,2,12c0,2.12.68,4.19,1.93,5.9l-1.75,2.53c-.21.31-.24.7-.06,1.03.17.33.51.54.89.54h9c5.51,0,10-4.49,10-10S17.51,2,12,2Zm0,18h-7.09l1.09-1.57c.26-.37.23-.88-.06-1.22-1.25-1.45-1.93-3.3-1.93-5.21,0-4.41,3.59-8,8-8s8,3.59,8,8-3.59,8-8,8Z"></path>
          </svg>
        </Link>

        <Link
          href="/notifications"
          className="relative text-white no-underline text-[0.95rem] font-medium transition-all hover:[text-shadow:_0_0_4px_#00ffff,0_0_8px_#ff00ff,0_0_12px_#00ff99]"
          title="Notifications"
        >
          <Bell className="w-6 h-6" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-5 min-w-5 px-1 flex items-center justify-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="font-extrabold max-sm:text-xl tracking-[0.4px] brand-title">BomberNet 🎮</div>
      </div>

      <div className="flex items-center max-sm:gap-0 gap-2 ml-auto">
        {user.id && (
          <Link
            href={`/profile/${user.id}`}
            className="text-white no-underline text-[0.95rem] font-medium transition-all hover:[text-shadow:_0_0_4px_#00ffff,0_0_8px_#ff00ff,0_0_12px_#00ff99]"
            title="Profile"
          >
            <Avatar
              user={user}
              size={8}
              color="radial-gradient(circle at 30% 30%, #00ffcc, #66ffff), #00ffcc"
            />
          </Link>
        )}

        <Link
          href="/bombermario#/bombermario"
          prefetch={false}
          title="Play Bomber Mario"
          className="inline-flex items-center justify-center w-9 h-9 rounded-md
             bg-[linear-gradient(180deg,#2a2a2a,#1f1f1f)] text-white
             shadow-[inset_0_0_0_1px_rgba(255,255,255,.05)]
             hover:-translate-y-[1px] hover:shadow-[0_6px_15px_rgba(0,255,200,.25)]
             transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 9v2H4v2h2v2h2v-2h2v-2H8V9H6zm12 0h-2v2h2v2h-2v2h2v-2h2v-2h-2z" />
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </Link>

        <button
          onClick={handleLogout}
          aria-label="Log out"
          className="inline-flex items-center gap-2 px-2 py-2 rounded-[10px] bg-[linear-gradient(180deg,#2a2a2a,#1f1f1f)] text-white cursor-pointer shadow-[inset_0_0_0_1px_rgba(255,255,255,.05)] transition hover:-translate-y-[1px] hover:border-[rgba(255,77,79,.5)] hover:bg-[linear-gradient(180deg,#3a2527,#23181a)] hover:shadow-[0_6px_20px_rgba(255,77,79,.25)]"
        >
          <LogOut size="16" />
        </button>
      </div>
    </nav>
  );
}
