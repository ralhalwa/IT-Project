import { h } from "../../framework/dom.js";
import { asArray } from "../utils/dom-helpers.js";
import { characters, duplicateColors } from "../constants/characters.js";

export default function LeftHud({ players, chatMessages, livesMap = {} }) {
  const seen = {};
  const AVATAR_SIZE = 64;
  const BAR_HEIGHT = 64;
  const CARD_W = 340;
  const BUBBLE_LEFT = 10;
  const BUBBLE_MAX_W = 240;
  const BUBBLE_BASE_GAP = 8;

  // Normalize players to an array so HUD never crashes if an object slips through
  const list = Array.isArray(players)
    ? players
    : (players && typeof players === "object" ? Object.values(players) : []);

  // Small heart icon
  const Heart = ({ filled = true, key }) =>
    h("svg", {
      key,
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      width: 18,
      height: 18,
      class: "drop-shadow",
      style: "flex:none",
    },
      h("path", {
        d: "M12 21s-6.716-4.29-9.428-7.002C.86 12.287.86 8.93 2.572 7.216c1.713-1.714 4.485-1.714 6.198 0L12 10.447l3.23-3.23c1.714-1.714 4.486-1.714 6.198 0 1.714 1.713 1.714 5.07 0 6.782C18.716 16.71 12 21 12 21z",
        fill: filled ? "#f43f5e" : "none",
        stroke: "#f43f5e",
        "stroke-width": 1.8
      })
    );

  return h(
    "div",
    {
      class: `
        fixed left-6 top-1/2 -translate-y-1/2 z-[1000]
        flex flex-col items-start gap-5
      `,
    },
    h(
      "ul",
      { class: "flex flex-col gap-5" },
      ...list.map((player, i) => {
        const playerChar = player?.character || "mario";
        const icon = characters[playerChar]?.icon || "https://placehold.co/64x64";

        if (!seen[playerChar]) seen[playerChar] = 0;
        seen[playerChar]++;
        const isDuplicate = seen[playerChar] > 1;
        const duplicateIndex = Math.max(0, seen[playerChar] - 2);
        const ring =
          duplicateColors[duplicateIndex % duplicateColors.length] || "border-transparent";

        const lives = Number(livesMap[player?.id]) >= 0 ? Number(livesMap[player.id]) : 3;
        const maxLives = 3; // adjust if you add power-ups later

        return h(
          "li",
          {
            key: `hud-${i}`,
            class: "relative transition-transform duration-200 hover:-translate-y-[2px]",
            style: `width:${CARD_W}px;`,
          },
          h(
            "div",
            {
              class: `
                relative flex items-center justify-center
                w-32 h-32
                bg-[url('/assets/Pipe.png')] bg-no-repeat bg-contain bg-center
              `,
            },
            h(
              "div",
              { class: "relative shrink-0" },
              h("div", {
                class: `absolute inset-0 rounded-full blur-[12px] ${isDuplicate ? "bg-white/15" : "bg-white/10"}`,
              }),
              h("img", {
                src: icon,
                alt: playerChar,
                class: `
                  rounded-full border-4
                  ${isDuplicate ? ring : "border-white/20"}
                  shadow-[0_6px_14px_rgba(0,0,0,.45)]
                  select-none pointer-events-none
                `,
                style: `
                  width:${AVATAR_SIZE}px;
                  height:${AVATAR_SIZE}px;
                  image-rendering:pixelated;
                `,
              })
            ),
            // Player name inside the pipe
            h(
              "div",
              { 
                class: `
                  absolute bottom-2 left-0 right-0
                  text-center
                ` 
              },
              h(
                "div",
                {
                  class: `
                    text-white font-bold tracking-wide
                    text-[14px] leading-tight
                    drop-shadow-[0_2px_4px_rgba(0,0,0,.8)]
                    bg-black/40 rounded-lg px-2 py-1
                    backdrop-blur-sm
                    max-w-[110px] mx-auto
                    truncate
                  `,
                },
                player?.name || `P${i + 1}`
              )
            ),

            // energy bar (linked to lives)
(() => {
  const maxLives = 3; // keep in sync with server
  const pid = player?.id;

  // robust lookup (numeric or string key), fallback to full lives
  const raw = livesMap?.[pid] ?? livesMap?.[String(pid)];
  let lives = Number(raw);
  if (!Number.isFinite(lives)) lives = maxLives;
  lives = Math.max(0, Math.min(maxLives, lives));

  const pct = Math.round((lives / maxLives) * 100);

  return h(
    "div",
    {
      class: `
        relative shrink-0 rounded-full overflow-hidden
        bg-black/30 border border-white/15
        shadow-[inset_0_-3px_4px_rgba(0,0,0,.25)]
      `,
      style: `width:6px;height:${BAR_HEIGHT}px;`,
      title: `${lives}/${maxLives} lives`,
      "aria-label": `${lives} of ${maxLives} lives`,
    },
    // fill from bottom → top
    h("div", {
      class: "absolute bottom-0 left-0 right-0 transition-[height] duration-300 ease-out",
      // note: 180deg (no space) so the gradient renders correctly
      style: `height:${pct}%;background: linear-gradient(180deg, #7dd3fc, #38bdf8, #0ea5e9);;box-shadow:0 0 8px rgba(16,185,129,.55);`,
    }),
    // subtle inner highlight
    h("span", {
      class: "pointer-events-none absolute inset-y-1 left-[1px] w-[2px] bg-white/25 rounded-full",
    }),
    // ticks at 1/3 and 2/3
    ...[1, 2].map((k) =>
      h("span", {
        key: `tick-${k}`,
        class: "absolute left-0 right-0 h-[2px] bg-black/25",
        style: `top: ${(k * 100) / 3}%;`,
      })
    )
  );
})(),


            // name + lives row
          ),

          // chat bubble: latest message for this player
          (() => {
            if (!Array.isArray(chatMessages) || !player?.name) return null;
            const lastMsg = [...chatMessages].reverse().find((m) => m && m.from === player.name);
            if (!lastMsg) return null;

            const text = (lastMsg.text ?? "").toString();
            const verticalOffsetPx = BUBBLE_BASE_GAP;

            return h(
              "div",
              {
                key: `player-chat-${lastMsg.id}`,
                "data-chat-id": lastMsg.id,
                class: `
                  absolute z-[1100] inline-block
                  text-sm leading-snug bg-white/95 text-black
                  rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,.25)]
                  border border-black/10 px-3.5 py-2
                  transition-all duration-500 translate-x-0 opacity-0
                  backdrop-blur-[2px] overflow-hidden
                `,
                style: `
                  left:${BUBBLE_LEFT}px;
                  bottom:calc(25% + ${verticalOffsetPx}px);
                  min-width: 140px;
                  max-width:${BUBBLE_MAX_W}px;
                `,
              },
              h("div", { class: "whitespace-normal break-words text-[14px] leading-5" }, text),
              h("span", {
                class: `
                  absolute left-3 -bottom-5 w-2.5 h-2.5 rotate-45
                  bg-white/95 border-l border-b border-black/10
                  shadow-[2px_2px_6px_rgba(0,0,0,.12)]
                `,
              })
            );
          })()
        );
      })
    )
  );
}
