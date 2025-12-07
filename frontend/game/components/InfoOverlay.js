import { h } from "../../framework/dom.js";
import { useEffect } from "../../framework/hooks.js";

function PowerupIcon({ type, src }) {
  return h("div", { class: "flex flex-col items-center" },
    h("img", {
      src: src,
      alt: type,
      class: "w-10 h-10 object-contain select-none mb-1",
      style: "image-rendering: pixelated;"
    }),
    h("span", { 
      class: "text-white/80 text-xs font-medium capitalize" 
    }, type)
  );
}

export default function InfoOverlay({ open, onClose, playerCharacter }) {
  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const fn = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);

  if (!open) return null;

  return h("div", {
    class: `
      fixed inset-0 z-[1000] flex items-center justify-center
      p-4 sm:p-6 md:p-8
    `
  },
    // Dim background
    h("div", {
      class: "absolute inset-0 bg-black/70 backdrop-blur-sm",
      onclick: onClose
    }),
    // Card
    h("div", {
      class: `
        relative w-full max-w-2xl max-h-[90vh] overflow-hidden
        rounded-3xl border border-white/15 bg-white/[.08] backdrop-blur-xl
        shadow-[0_30px_80px_rgba(0,0,0,.6)]
        animate-[fadeIn_.18s_ease-out]
      `
    },
      // Header
      h("div", {
        class: `
          px-6 py-4 border-b border-white/10
          flex items-center justify-between
          bg-gradient-to-r from-white/[.06] to-white/[.02]
        `
      },
        h("div", { class: "flex items-center gap-3" },
          h("img", {
            src: "/assets/bomb.png", alt: "",
            class: "w-7 h-7 select-none", style: "image-rendering: pixelated;"
          }),
          h("h2", { class: "text-white text-xl font-bold tracking-wide" }, "How to Play")
        ),
        h("button", {
          class: `
            w-9 h-9 rounded-full border border-white/20 text-white/90 text-center
            hover:bg-white/10 active:scale-95 transition
          `,
          onclick: onClose,
          "aria-label": "Close info"
        }, "✕")
      ),

      // Body
      h("div", { class: "p-6 overflow-y-auto max-h-[calc(90vh-64px)]" },
        
        // Character Animation Section
        h("div", { class: "flex flex-col items-center mb-6" },
          h("div", { class: "text-white text-lg font-semibold mb-2" }, ""),
          h("img", {
            src: `/assets/Characters/Animations/${playerCharacter}.gif`,
            alt: playerCharacter,
            class: "w-44 h-44 object-contain select-none mb-2",
            style: "image-rendering: pixelated;"
          }),
          // h("span", { 
          //   class: "text-white/90 font-medium capitalize text-lg" 
          // }, playerCharacter)
        ),

        // Simple Instructions
        h("div", { class: "grid grid-cols-1 gap-4 mb-6" },
          // Movement
          h("div", { 
            class: "bg-white/[.06] rounded-xl p-4 border border-white/10" 
          },
            h("div", { class: "text-white font-semibold mb-2 text-center" }, "Controls"),
            h("div", { class: "text-white/80 text-sm" },
              h("div", null, "• Move: Arrow Keys or WASD"),
              h("div", null, "• Drop Bomb: Space or B"),
              h("div", null, "• Chat: Quick Chat Button")
            )
          ),

          // Objective
          h("div", { 
            class: "bg-white/[.06] rounded-xl p-4 border border-white/10" 
          },
            h("div", { class: "text-white font-semibold mb-2 text-center" }, "Goal"),
            h("div", { class: "text-white/80 text-sm" },
              h("div", null, "• Be the last player standing"),
              h("div", null, "• Use bombs to eliminate others"),
              h("div", null, "• Avoid your own explosions")
            )
          ),

          // Powerups Section
          h("div", { 
            class: "bg-white/[.06] rounded-xl p-4 border border-white/10" 
          },
            h("div", { class: "text-white font-semibold mb-3 text-center" }, "Collect Powerups"),
            h("div", { class: "grid grid-cols-4 gap-3" },
              PowerupIcon({
                type: "Speed",
                src: "/assets/PowerUps/Speed_PowerUp.png",
                class: "w-40 h-40"
              }),
              PowerupIcon({
                type: "Flame", 
                src: "/assets/PowerUps/Flame_PowerUp.png",
                class: "w-40 h-40"
              }),
              PowerupIcon({
                type: "Bomb",
                src: "/assets/PowerUps/Bomb_PowerUp.png",
                class: "w-40 h-40"
              }),
              PowerupIcon({
                type: "Life",
                src: "/assets/PowerUps/Life_PowerUp3.png",
                class: "w-40 h-40"
              })
            ),
            h("div", { class: "text-white/70 text-xs mt-3 text-center" },
              ""
            )
          )
        ),

        // Quick Tips
        h("div", { 
          class: "bg-white/[.06] rounded-xl p-4 border border-white/10" 
        },
          h("div", { class: "text-white font-semibold mb-2 text-center" }, "Quick Tips"),
          h("div", { class: "text-white/80 text-sm" },
            h("div", null, "• Bombs explode after 2 seconds"),
            h("div", null, "• Chain explosions for bigger blasts"),
            h("div", null, "• Watch out for trap spots")
          )
        ),

        // Footer
        h("div", { 
          class: "text-center text-zinc-400/90 text-xs mt-6 pt-4 border-t border-white/10" 
        },
          "Last player standing wins!"
        )
      )
    )
  );
}