import { useEffect } from "react";
import { Press_Start_2P } from "next/font/google";

const press = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export default function GameOverPage() {
  useEffect(() => {
    // Route the micro-router to the gameover screen
    if (window.location.hash !== "#/gameover") {
      window.location.hash = "#/gameover";
    }

    // Load the bomberman CSS (same as game + lobby)
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/bomberman/style.css";
    document.head.appendChild(link);

    // Boot the mini-app
    import("../../main.js").catch((err) => {
      console.error("Failed to load Bomber main.js", err);
      alert("Failed to load the Bomber game. Check console.");
    });

    return () => {
      document.head.removeChild(link);
    };
  }, []);

  return (
    <div id="app" className={press.className} style={{ minHeight: "100vh" }} />
  );
}
