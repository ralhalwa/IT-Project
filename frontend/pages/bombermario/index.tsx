"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Press_Start_2P } from "next/font/google";

const press = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

function isMobileDevice() {
  if (typeof window === "undefined") return false;

  const isCoarsePointer =
    window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const isSmallScreen =
    window.matchMedia?.("(max-width: 768px)").matches ?? false;

  const ua = navigator.userAgent || "";
  const uaMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

  return (isCoarsePointer && isSmallScreen) || uaMobile;
}

export default function BomberMarioWrapper() {
  const router = useRouter();

  const [mobile, setMobile] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  // 1) detect mobile
  useEffect(() => {
    const update = () => setMobile(isMobileDevice());
    update();

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  // 2) session guard like /messages
  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const rMe = await fetch("/api/me", { credentials: "include" });
        if (!rMe.ok) {
          if (!cancelled) {
            setIsAuthed(false);
            setAuthChecked(true);
            router.push("/login");
          }
          return;
        }

        if (!cancelled) {
          setIsAuthed(true);
          setAuthChecked(true);
        }
      } catch {
        if (!cancelled) {
          setIsAuthed(false);
          setAuthChecked(true);
          router.push("/login");
        }
      }
    };

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // 3) boot game ONLY if: auth ok + not mobile
  useEffect(() => {
    if (!authChecked) return;
    if (!isAuthed) return;
    if (mobile) return;

    // expose roomId globally for the bomberman app
    try {
      const params = new URLSearchParams(window.location.search);
      const roomId = params.get("roomId") || "public";
      (window as any).__bm_roomId = roomId;
    } catch {
      (window as any).__bm_roomId = "public";
    }

    // force SPA hash to lobby
    const TARGET = "#/lobby";
    if (window.location.hash !== TARGET) {
      window.location.hash = TARGET;
    }

    // inject css
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/bomberman/style.css";
    document.head.appendChild(link);

    // boot app
    const rafId = requestAnimationFrame(() => {
      import("../../main.js").catch((err) => {
        console.error("Failed to load Bomber main.js", err);
        alert("Failed to load the Bomber game. Check console.");
      });
    });

    return () => {
      cancelAnimationFrame(rafId);
      try {
        document.head.removeChild(link);
      } catch {}
    };
  }, [authChecked, isAuthed, mobile]);

  // loading while checking session (prevents flicker)
  if (!authChecked) {
    return (
      <div
        className={press.className}
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(135deg, #0b0b10, #111827)",
          color: "white",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div style={{ opacity: 0.85, fontSize: 12 }}>Loading…</div>
      </div>
    );
  }

  // if not authed, we already pushed to /login — render nothing
  if (!isAuthed) return null;

  // mobile message UI (only after auth ok)
  if (mobile) {
    return (
      <div
        className={press.className}
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background:
            "radial-gradient(circle at 30% 20%, rgba(138, 99, 255, .25), transparent 50%), linear-gradient(135deg, #0b0b10, #111827)",
          color: "white",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "min(560px, 100%)",
            borderRadius: "18px",
            padding: "20px",
            border: "1px solid rgba(255,255,255,.12)",
            background: "rgba(255,255,255,.06)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ fontSize: 22, marginBottom: 10 }}>🎮 Bomber Mario</div>

          <div style={{ fontSize: 12, lineHeight: 1.7, opacity: 0.9 }}>
            This game is made for <b>laptop/desktop</b> (keyboard controls + wider
            screen).
            <br />
            Mobile play isn’t supported yet.
          </div>

          <div style={{ height: 14 }} />

          <div style={{ fontSize: 11, opacity: 0.75, lineHeight: 1.7 }}>
            ✅ Open this page on a laptop/PC to play.
            <br />
            (You can still use BomberNet features on mobile.)
          </div>

          <div style={{ height: 16 }} />

          <button
            onClick={() => router.push("/")}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "14px",
              border: "1px solid rgba(255,255,255,.12)",
              background:
                "linear-gradient(180deg, rgba(99,102,241,.95), rgba(79,70,229,.95))",
              color: "white",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  // desktop: booted SPA will mount into #app
  return (
    <div id="app" className={press.className} style={{ minHeight: "100vh" }} />
  );
}
