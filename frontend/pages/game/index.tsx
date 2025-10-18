import { useEffect } from "react";
import { Press_Start_2P } from "next/font/google";

const press = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export default function GamePage() {
  useEffect(() => {
    // send your micro-router to the in-app game route
    if (window.location.hash !== "#/game") {
      window.location.hash = "#/game";
    }

    // load page-specific CSS from /public (wallpaper etc.)
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/bomberman/style.css";
    document.head.appendChild(link);

    // load the mini app
    import("../../main.js").catch((err) => {
      console.error("Failed to load Bomber main.js", err);
      alert("Failed to load the Bomber game. Check console.");
    });

    return () => {
      document.head.removeChild(link);
    };
  }, []);

  return <div id="app" className={press.className} style={{ minHeight: "100vh" }} />;
}
