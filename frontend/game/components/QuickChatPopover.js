import { h } from "../../framework/dom.js";

export default function QuickChatPopover({ quickText, setQuickText, onSend, onClose }) {
  return h(
    "div",
    { class: "fixed right-28 top-1/2 -translate-y-[160px] z-[999]" },
    h(
      "div",
      {
        class: `
          flex items-center gap-2
          bg-black/60 border border-white/30 backdrop-blur
          rounded-xl p-2 shadow-[0_10px_20px_rgba(0,0,0,.45)]
        `,
      },
      h("input", {
        class: `
          w-56 px-3 py-2 rounded
          bg-gray-800 border border-gray-600 text-white
          placeholder:text-gray-400
        `,
        placeholder: "Type message...",
        value: quickText,
        onInput: (e) => setQuickText(e.target.value),
        onKeydown: (e) => {
          if (e.key === "Enter" && e.target.value.trim()) onSend();
          if (e.key === "Escape") onClose();
        },
        autofocus: true,
      }),
      h(
        "button",
        {
          class: `
            px-3 py-2 rounded
            bg-green-600 hover:bg-green-700 active:scale-95 transition
            text-white
          `,
          onClick: onSend,
        },
        "Send"
      ),
      h(
        "button",
        {
          class: `
            px-2 py-2 rounded
            bg-gray-700 hover:bg-gray-600 active:scale-95 transition
            text-white
          `,
          onClick: onClose,
          "aria-label": "Close quick chat",
          title: "Close",
        },
        "×"
      )
    )
  );
}
