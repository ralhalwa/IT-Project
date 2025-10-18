import { h } from "../../framework/dom.js";

export default function Game() {
  return h(
    "div",
    {
      class:
        "min-h-screen w-full flex items-center justify-center",
      style: `
        background-image: url('/wallpapers/game-bg.jpg');
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
      `,
    },
    h(
      "h2",
      { class: "text-lg mb-2 text-center bg-blue-700 text-white px-4 py-2 rounded" },
      "game"
    )
  );
}
