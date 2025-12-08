"use client";

import { useEffect } from "react";
import { Press_Start_2P } from "next/font/google";

const press = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export default function BomberMarioWrapper() {
  useEffect(() => {
    // 0) Expose roomId globally for the bomberman app
    try {
      const params = new URLSearchParams(window.location.search);
      const roomId = params.get("roomId") || "public"; // 👈 public lobby when no roomId
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
      document.head.removeChild(link);
    };
  }, []);

  return (
    <div id="app" className={press.className} style={{ minHeight: "100vh" }} />
  );
}
