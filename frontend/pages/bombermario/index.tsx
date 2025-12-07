"use client";

import { useEffect } from "react";
import { Press_Start_2P } from "next/font/google";

// Load your retro game font
const press = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export default function BomberMarioWrapper() {
  useEffect(() => {
    /* ------------------------------------------------------------------
       1) Load bomberman CSS dynamically from /public/bomberman/style.css
       ------------------------------------------------------------------ */
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/bomberman/style.css";
    document.head.appendChild(link);

    /* ------------------------------------------------------------------
       2) Make sure the hash route is set BEFORE mounting the game engine
       ------------------------------------------------------------------ */
    const TARGET = "#/bombermario";

    if (window.location.hash !== TARGET) {
      window.location.hash = TARGET;
    }

    /* ------------------------------------------------------------------
       3) IMPORTANT FIX:
          Wait one animation frame so the browser applies the hash,
          THEN load main.js.

          Without this delay → main.js boots too early,
          sees a WRONG ROUTE → produces a BLANK SCREEN until refresh.
       ------------------------------------------------------------------ */
    const boot = () => {
      import("../../main.js")
        .then(() => {
          // mini-app loaded successfully
        })
        .catch((err) => {
          console.error("Failed to load Bomber main.js", err);
          alert("Failed to load the Bomber game. Check console.");
        });
    };

    const rafId = requestAnimationFrame(boot);

    /* ------------------------------------------------------------------
       Cleanup removes injected CSS if user navigates away
       ------------------------------------------------------------------ */
    return () => {
      cancelAnimationFrame(rafId);
      document.head.removeChild(link);
    };
  }, []);

  /* ------------------------------------------------------------------
     The mini-game mounts into the #app container
     The retro font is applied globally here
     ------------------------------------------------------------------ */

  return <div id="app" className={press.className} style={{ minHeight: "100vh" }} />;
}
