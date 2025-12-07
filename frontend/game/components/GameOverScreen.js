import { h } from "../../framework/dom.js";
import { useState, useEffect, useLocalStorageState } from "../../framework/hooks.js";

export function GameOverScreen() {
  const [visible, setVisible] = useState(false);
  const [gameOver, setGameOver] = useLocalStorageState("bm_gameover_v2", {});

  // 🔁 If someone opens /gameover with no stored winner, bounce back to lobby
  useEffect(() => {
    const noData = !gameOver || (gameOver.name === undefined && gameOver.name !== "Unknown");
    if (noData) {
      setGameOver({});
      window.location.href = "/bombermario"; // go to lobby page
    }
  }, [gameOver, setGameOver]);

  // 👑 Winner object (fallback to empty)
  const winner = gameOver || {};

  // ✅ Safe winner check so .toUpperCase() never crashes
  const hasRealWinner =
    winner &&
    typeof winner.name === "string" &&
    winner.name.trim() !== "" &&
    winner.name !== "Unknown";

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  // 🔙 Button: clear gameOver and go to lobby page
  const onReturn = () => {
    setGameOver({});
    window.location.href = "/bombermario"; // this is your lobby route in Next
  };

  return h(
    "div",
    {
      class: `
        fixed inset-0 z-[9999] flex flex-col items-center justify-center
        bg-black bg-opacity-90 text-white
        transition-opacity duration-700 ${visible ? "" : "hidden"}
      `,
    },
    // Big pixel Game Over text
    h(
      "h1",
      {
        class: `
          text-4xl sm:text-6xl font-bold mb-6 text-red-500
          drop-shadow-[4px_4px_0_#000] tracking-widest
          uppercase select-none
        `,
      },
      "GAME OVER"
    ),

    // Winner text (safe)
    h(
      "p",
      {
        class: `
          text-lg sm:text-2xl text-yellow-300 mb-8 text-center
          drop-shadow-[2px_2px_0_#000]
        `,
      },
      hasRealWinner
        ? `🏆 Winner: ${winner.name.toUpperCase()}`
        : "💀 Everyone perished!"
    ),

    // Return button
    h(
      "button",
      {
        class: `
          bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-3 px-6
          border-4 border-black rounded-lg shadow-[4px_4px_0_0_#000]
          active:translate-x-[2px] active:translate-y-[2px]
          transition-transform duration-100
          text-sm sm:text-base
        `,
        onClick: onReturn,
      },
      "RETURN TO LOBBY"
    )
  );
}
