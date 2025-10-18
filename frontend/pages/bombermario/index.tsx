import { useEffect } from "react";
import { Press_Start_2P } from "next/font/google";

// Load the font the Next.js way
const press = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export default function BomberMarioWrapper() {
  useEffect(() => {
    // Ensure hash router starts on a known route
    if (window.location.hash !== "#/bombermario") {
      window.location.hash = "#/bombermario";
    }

    // ✅ Dynamically load the page CSS from /public (works for your wallpaper)
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/bomberman/style.css";
    document.head.appendChild(link);

    // Load the mini-app after mount (client-only)
    import("../../main.js").catch((err) => {
      console.error("Failed to load Bomber main.js", err);
      alert("Failed to load the Bomber game. Check console.");
    });

    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Apply the font to everything inside the app root
  return <div id="app" className={press.className} style={{ minHeight: "100vh" }} />;
}
