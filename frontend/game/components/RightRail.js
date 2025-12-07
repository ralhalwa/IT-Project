import { h } from "../../framework/dom.js";

export default function RightRail({ toggleQuickChat, toggleAudioPanel, micOn, onMicToggle }) {
  return h(
    "div",
    {
      class: `
        fixed right-8 top-1/2 -translate-y-1/2
        flex flex-col items-center gap-5 z-[998]
      `,
    },
    // Chat
    h(
      "button",
      {
        "aria-label": "Chat",
        class: `
          w-20 h-20 rounded-full
          flex items-center justify-center
          bg-black/50 border-2 border-white/30 backdrop-blur
          shadow-[0_10px_20px_rgba(0,0,0,.45)]
          hover:scale-105 active:scale-95 transition-transform
        `,
        onClick: toggleQuickChat,
      },
      h("img", {
        src: "/assets/chat.png",
        alt: "chat",
        class: "w-[72%] h-[72%] object-contain select-none pointer-events-none",
        style: "image-rendering: pixelated;",
      })
    ),
    // Speaker
    h(
      "button",
      {
        "aria-label": "Sound",
        class: `
          w-20 h-20 rounded-full
          flex items-center justify-center
          bg-black/50 border-2 border-white/30 backdrop-blur
          shadow-[0_10px_20px_rgba(0,0,0,.45)]
          hover:scale-105 active:scale-95 transition-transform
        `,
        onClick: toggleAudioPanel,
      },
      h("img", {
        src: "/assets/speacker.png",
        alt: "speacker",
        class: "w-[72%] h-[72%] object-contain select-none pointer-events-none",
        style: "image-rendering: pixelated;",
      })
    ),
    // Mic
    h(
      "button",
      {
        "aria-label": micOn ? "Mute mic" : "Unmute mic",
        title: micOn ? "Mute mic" : "Unmute mic",
        class: `
          relative
          w-20 h-20 rounded-full
          flex items-center justify-center
          bg-black/50 border-2 ${micOn ? "border-white/30" : "border-red-400/60"}
          backdrop-blur
          shadow-[0_10px_20px_rgba(0,0,0,.45)]
          hover:scale-105 active:scale-95 transition-transform
        `,
        onClick: onMicToggle,
      },
      h("img", {
        src: "/assets/mic.png",
        alt: "mic",
        class: `
          w-[72%] h-[72%] object-contain select-none pointer-events-none
          ${micOn ? "" : "grayscale opacity-60"}
        `,
        style: "image-rendering: pixelated;",
      }),
      h("span", {
        class: `
          absolute bottom-2 right-2 w-3 h-3 rounded-full
          ${micOn ? "bg-green-400" : "bg-red-500"}
          ring-2 ring-black/50
        `,
      }),
      !micOn
        ? h("span", {
            class: `
              pointer-events-none
              absolute w-12 h-[3px] rotate-45
              bg-red-400/80 rounded
            `,
          })
        : null
    )
  );
}
