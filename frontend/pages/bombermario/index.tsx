import { useEffect } from "react";
import { Press_Start_2P } from "next/font/google";

const press = Press_Start_2P({ weight: "400", subsets: ["latin"], display: "swap" });

export default function BomberMarioWrapper() {
  useEffect(() => {
    // 1) load page CSS from /public
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/bomberman/style.css";
    document.head.appendChild(link);

    // 2) ensure the hash route exists BEFORE loading main.js
    const TARGET = "#/bombermario";
    if (window.location.hash !== TARGET) {
      window.location.hash = TARGET;        // set synchronously
    }

    // 3) wait one micro-tick so the browser processes the hashchange,
    //    then import your mini-app so it reads the correct route.
    const boot = () => {
      import("../../main.js").catch((err) => {
        console.error("Failed to load Bomber main.js", err);
        alert("Failed to load the Bomber game. Check console.");
      });
    };
    // one frame is enough to avoid race
    const id = requestAnimationFrame(boot);

    return () => {
      cancelAnimationFrame(id);
      document.head.removeChild(link);
    };
  }, []);

  return <div id="app" className={press.className} style={{ minHeight: "100vh" }} />;
}
