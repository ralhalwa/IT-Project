import { h } from "../../framework/dom.js";
import { asArray } from "../utils/dom-helpers.js";
import { characters } from "../constants/characters.js";

export default function AudioPanel({ players, mutedMap, toggleMuted, selfName }) {
  function normalizeName(name) {
   let cleaned = String(name || "").trim();

  // Remove surrounding quotes if they exist
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.toLowerCase();
  }

  const list = asArray(players).filter(p => p && p.name !== normalizeName(selfName)); // hide myself

  return h(
    "div",
    { class: "fixed right-28 top-1/2 -translate-y-[20px] z-[999]" },
    h(
      "div",
      {
        class: `
          bg-black/60 border border-white/30 backdrop-blur
          rounded-2xl p-2 shadow-[0_10px_20px_rgba(0,0,0,.45)]
        `,
      },
      h(
        "div",
        { class: "grid grid-cols-3 gap-2" },
        ...list.map((p) => {
          const id = p.id;
          const icon = characters[p?.character || "mario"]?.icon || "https://placehold.co/64x64";
          const nickname = p?.name || "Player";
          const isMuted = !!mutedMap[nickname];

          return h(
            "div",
            { key: `aud-${id}`, class: "relative group" },
            h(
              "button",
              {
                title: nickname,
                "aria-pressed": isMuted ? "true" : "false",
                class: `
                  w-12 h-12 rounded-full overflow-hidden
                  border-2 ${isMuted ? "border-gray-400" : "border-white/40"}
                  bg-black/30 hover:scale-105 active:scale-95 transition
                  flex items-center justify-center
                `,
                onClick: () => toggleMuted(nickname), // 🔊 toggle by name (server enforces unique names)
              },
              h("img", {
                src: icon,
                alt: p?.character || "player",
                class: `
                  w-full h-full object-cover
                  ${isMuted ? "grayscale opacity-70" : ""}
                  select-none pointer-events-none
                `,
                style: "image-rendering: pixelated;",
              })
            ),
            h(
              "span",
              {
                class: `
                  absolute -top-6 left-1/2 -translate-x-1/2
                  bg-black/80 text-white text-xs px-2 py-1 rounded
                  opacity-0 group-hover:opacity-100 transition-opacity duration-200
                  whitespace-nowrap pointer-events-none
                `,
              },
              nickname
            )
          );
        })
      )
    )
  );
}
