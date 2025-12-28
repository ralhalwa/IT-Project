"use client";

import { useEffect, useMemo, useState } from "react";
import { Press_Start_2P } from "next/font/google";

const press = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

function isMobileDevice() {
  if (typeof window === "undefined") return false;

  // ✅ best practical check: touch device + small screen
  const isCoarsePointer =
    window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const isSmallScreen = window.matchMedia?.("(max-width: 768px)").matches ?? false;

  // fallback (older devices)
  const ua = navigator.userAgent || "";
  const uaMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

  return (isCoarsePointer && isSmallScreen) || uaMobile;
}

export default function BomberMarioWrapper() {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    // detect at mount + on resize/orientation
    const update = () => setMobile(isMobileDevice());
    update();

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  useEffect(() => {
    // ✅ If mobile -> do NOT boot the game
    if (mobile) return;

    // 0) Expose roomId globally for the bomberman app
    try {
      const params = new URLSearchParams(window.location.search);
      const roomId = params.get("roomId") || "public"; // public lobby when no roomId
      (window as any).__bm_roomId = roomId;
    } catch {
      (window as any).__bm_roomId = "public";
    }

    // 1) Force the SPA hash to the lobby route
    const TARGET = "#/lobby";
    if (window.location.hash !== TARGET) {
      window.location.hash = TARGET;
    }

    // 2) Inject Bomberman CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/bomberman/style.css";
    document.head.appendChild(link);

    // 3) Boot the mini-app on next frame
    const rafId = requestAnimationFrame(() => {
      import("../../main.js").catch((err) => {
        console.error("Failed to load Bomber main.js", err);
        alert("Failed to load the Bomber game. Check console.");
      });
    });

    // Cleanup
    return () => {
      cancelAnimationFrame(rafId);
      try {
        document.head.removeChild(link);
      } catch {
        /* ignore */
      }
    };
  }, [mobile]);

  // ✅ Mobile message UI
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
            This game is built for <b>laptop/desktop</b> (keyboard controls + wider
            screen).
            <br />
            On mobile, the gameplay experience isn’t supported yet.
          </div>

          <div style={{ height: 14 }} />

          <div style={{ fontSize: 11, opacity: 0.75, lineHeight: 1.7 }}>
            ✅ Open this page on a laptop/PC to play.
            <br />
            (Tip: You can still browse BomberNet features on mobile.)
          </div>

          <div style={{ height: 16 }} />

          <button
            onClick={() => (window.location.href = "/")}
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

  // ✅ Desktop: boot the game normally
  return (
    <div id="app" className={press.className} style={{ minHeight: "100vh" }} />
  );
}
