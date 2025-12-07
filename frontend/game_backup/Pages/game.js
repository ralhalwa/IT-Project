import { h } from "../../framework/dom.js";
import { useState, useEffect } from "../../framework/hooks.js";
import BomberMario from "./BomberMario.js"; // to access __socket

const characters = {
  mario: { name: "Mario", icon: "./assets/Characters/icons/Mario.png" },
  peach: { name: "Peach", icon: "./assets/Characters/icons/Peach.png" },
  yoshi: { name: "Yoshi", icon: "./assets/Characters/icons/Yoshi.png" },
  toadette: {
    name: "Toadette",
    icon: "./assets/Characters/icons/Toadette.png",
  },
};

const duplicateColors = [
  "border-blue-500",
  "border-green-500",
  "border-purple-500",
];

export default function Game() {
    
    const BOMB_COOLDOWN_MS = 900; // tweak as you like
const [bombCooling, setBombCooling] = useState(false);

function placeBomb() {
  if (bombCooling) return;
  const ws = getSocket();
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "place-bomb" })); // server can handle this later
  }
  setBombCooling(true);
  setTimeout(() => setBombCooling(false), BOMB_COOLDOWN_MS);
}

  const [players, setPlayers] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  let seen = {};

  function getSocket() {
    return BomberMario.__socket; //using singleton socket from BomberMario page
  }

  function handleServerMessage(msg) {
    if (!msg || !msg.type) return;

    if (msg.type === "start") {
      const p = msg.payload || {};
      if (Array.isArray(p.players)) setPlayers(p.players);
    } else if (msg.type === "error") {
      alert(msg.message || "Server error");
    } else if (msg.type === "chat") {
      const payload = msg.payload;

      // Make sure the stored message always has a { from, text } format
      const normalized = {
        from: payload?.from || "Unknown",
        text: payload?.text || "",
        id: Date.now(),
      };

      // ✅ Add safely
      setChatMessages((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return [...safePrev, normalized];
      });

      setTimeout(() => {
        const el = document.querySelector(`[data-chat-id="${normalized.id}"]`);
        if (el) {
          el.classList.remove("translate-x-0", "opacity-0");
          el.classList.add("translate-x-42", "opacity-100");
        }
      }, 50);

      // Remove after 2 seconds with reverse animation
      setTimeout(() => {
        const el = document.querySelector(`[data-chat-id="${normalized.id}"]`);
        if (el) {
          el.classList.remove("translate-x-42", "opacity-100");
          el.classList.add("translate-x-0", "opacity-0");
        }

        // ✅ Remove after 2s safely
        setTimeout(() => {
          setChatMessages((prev) => {
            const safePrev = Array.isArray(prev) ? prev : [];
            return safePrev.filter((m) => m.id !== normalized.id);
          });
        }, 1000);
      }, 5000);
    } else {
      // ignore other message types or log for debug
      // console.log("game msg", msg);
    }
  }
useEffect(() => {
  function onKey(e) {
    const k = e.key?.toLowerCase();
    if (k === " " || k === "b") {
      e.preventDefault();
      placeBomb();
    }
  }
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [bombCooling]);

  useEffect(() => {
    const ws = getSocket();
    if (!ws) {
      alert("No WebSocket found — returning to lobby.");
      window.location.href = "/";
      return;
    }

    ws.send(JSON.stringify({ type: "game-state", payload: { text: "" } }));

    // our handler: replace onmessage (we assume route components own handler)
    const prevOnMessage = ws.onmessage;
    const prevOnClose = ws.onclose;

    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch (e) {
        console.warn("Invalid WS message", ev.data);
        return;
      }
      handleServerMessage(msg);
    };

    ws.onclose = (ev) => {
      alert("Connection lost — returning to lobby.");
      window.location.href = "/";
      if (typeof prevOnClose === "function") prevOnClose(ev);
    };

    // cleanup on unmount: restore previous handlers (defensive)
    return () => {
      try {
        if (ws) {
          // restore if we overwrote other handlers
          ws.onmessage = prevOnMessage;
          ws.onclose = prevOnClose;
        }
      } catch {}
    };
  }, []);

  useEffect(() => {
    // scroll chat to bottom on new message
    const chatBox = document.getElementById("chat-box");
    if (chatBox) {
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  }, [chatMessages]);

  function sendChat() {
    const ws = getSocket();
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      alert("Not connected");
      return;
    }
    if (!chatInput.trim()) return;
    ws.send(JSON.stringify({ type: "chat", payload: { text: chatInput } }));
    setChatInput("");
  }
// --- Quick chat state (right-rail popover) ---
const [showQuickChat, setShowQuickChat] = useState(false);
const [quickText, setQuickText] = useState("");

function sendQuickChat() {
  const ws = getSocket();
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (!quickText.trim()) return;
  ws.send(JSON.stringify({ type: "chat", payload: { text: quickText } }));
  setQuickText("");
  setShowQuickChat(false);
}

  return h(
    "div",
    {
      class: "min-h-screen w-full flex items-center justify-center",
      style: `
        background-image: url('/assets/Arena.png');
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
      `,
    },
   // Floating Bomb Button (bigger version)
h(
  "button",
  {
    "aria-label": "Drop bomb",
    class: `
      fixed right-8 bottom-8 z-[999]
      w-24 h-24 rounded-full
      flex items-center justify-center
      bg-black/50 border-2 border-white/30 backdrop-blur
      shadow-[0_12px_25px_rgba(0,0,0,.45)]
      transition-transform active:scale-95
      ${bombCooling ? "opacity-60 pointer-events-none" : ""}
    `,
    onClick: placeBomb,
    onTouchStart: (e) => { e.preventDefault(); placeBomb(); },
  },
  // Icon — same look, just bigger
  h("span", { class: "text-6xl select-none" }, "💣"),
  bombCooling
    ? h(
        "span",
        {
          class: `
            absolute -top-2 -right-2 text-xs
            px-2 py-1 rounded bg-yellow-400 text-black
            font-semibold tracking-wide
          `,
        },
        "space"
      )
    : null
)

,// RIGHT RAIL: chat / sound / mic (glassy, matches bomb)
h(
  "div",
  {
    class: `
      fixed right-8 top-1/2 -translate-y-1/2
      flex flex-col items-center gap-5 z-[998]
    `,
  },

  // shared style same as bomb, just a bit smaller
  // chat
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
      onClick: () => setShowQuickChat((v) => !v),
    },
    
    h("span", { class: "text-4xl select-none" }, "💬")
  ),

  // sound
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
    },
    h("span", { class: "text-4xl select-none" }, "🔊")
  ),

  // mic
  h(
    "button",
    {
      "aria-label": "Mic",
      class: `
        w-20 h-20 rounded-full
        flex items-center justify-center
        bg-black/50 border-2 border-white/30 backdrop-blur
        shadow-[0_10px_20px_rgba(0,0,0,.45)]
        hover:scale-105 active:scale-95 transition-transform
      `,
    },
    h("span", { class: "text-4xl select-none" }, "🎤")
  )
),
showQuickChat
  ? h(
      "div",
      {
        class: `
          fixed right-28 top-1/2 -translate-y-[160px]
          z-[999]
        `,
      },
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
            if (e.key === "Enter" && e.target.value.trim()) sendQuickChat();
            if (e.key === "Escape") setShowQuickChat(false);
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
            onClick: sendQuickChat,
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
            onClick: () => setShowQuickChat(false),
            "aria-label": "Close quick chat",
            title: "Close",
          },
          "×"
        )
      )
    )
  : null,

// TOP-RIGHT: Info button (smaller, clean, glassy)
h(
  "button",
  {
    "aria-label": "Game info",
    class: `
      fixed right-6 top-5 z-[999]
      w-12 h-12 rounded-full
      flex items-center justify-center
      cursor-pointer
      bg-black/50 border border-white/30 backdrop-blur
      shadow-[0_6px_15px_rgba(0,0,0,.4)]
      hover:scale-105 active:scale-95 transition-transform
      focus:outline-none focus:ring-2 focus:ring-yellow-300/60
    `,
    onClick: () => {
      console.log("Info button clicked");
    },
  },
  // clean minimalistic 'i' symbol
  h(
    "span",
    {
      class: `
        text-lg text-white font-semibold select-none
        tracking-wide
      `,
    },
    "i"
  )
),

    h(
      "div",
      {
        class: "absolute left-0 ",
      },
      h(
        "ul",
        { class: "space-y-2" },
        ...Array(players.length)
          .fill(null)
          .map((_, i) => {
            const player = players[i];
            const playerChar = player?.character;

            let isDuplicate = false;
            let duplicateIndex = -1;

            if (playerChar) {
              if (!seen[playerChar]) seen[playerChar] = 0;
              seen[playerChar]++;

              if (seen[playerChar] > 1) {
                isDuplicate = true;
                // first duplicate gets index 0
                duplicateIndex = seen[playerChar] - 2;
              }
            }

            return h(
              "li",
              {
                key: `pl-slot-${i}`,
                class: `z-10 transform-3d`,
              },
              h(
                "div",
                {
                  class: "relative z-20",
                },
                h("img", {
                  src: "/assets/Pipe.png",
                  class: `h-34 w-74 -translate-x-1`,
                })
              ),
              player
                ? h(
                    "div",
                    {
                      class:
                        "flex absolute z-20 transform-3d translate-x-2 -translate-y-[90px] items-center gap-2",
                    },
                    h("img", {
                      src:
                        characters[playerChar || "mario"]?.icon ||
                        "https://placehold.co/48x48",
                      alt: playerChar || "mario",
                      class: `absolute translate-x-52 translate-y-2 w-16 h-16 border-4 rounded-xl ${
                        isDuplicate
                          ? duplicateColors[
                              duplicateIndex % duplicateColors.length
                            ]
                          : "border-transparent"
                      }`,
                    }),
                    h("span", { class: "translate-y-1" }, player.name),
                    ...(Array.isArray(chatMessages) ? chatMessages : [])
                      .filter((m) => m && m.from === player.name)
                      .map((m, idx) => {
                        return h(
                          "div",
                          {
                            key: `player-chat-${idx}`,
                            "data-chat-id": m.id,
                            class: `
                            absolute left-[120px]
                            -translate-z-50
                            max-w-32
                            text-center
                            text-xs
                            overflow-hidden
                            text-ellipsis
                            translate-y-3
                            bg-white text-black px-3 py-1 rounded-xl shadow-lg
                            transition-all duration-500
                            translate-x-0 opacity-0
                          `,
                          },
                          m.text
                        );
                      })
                  )
                : `P${i + 1}: WAITING...`
            );
          })
      ),
    //   h(
    //     "div",
    //     { class: "mt-2 flex gap-2" },
    //     h("input", {
    //       class:
    //         "flex-1 px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white",
    //       placeholder: "Say something...",
    //       value: chatInput,
    //       onInput: (e) => setChatInput(e.target.value),
    //       onKeydown: (e) => {
    //         if (e.key === "Enter" && e.target.value.trim()) {
    //           sendChat();
    //           e.target.value = "";
    //         }
    //       },
    //     }),
    //     h(
    //       "button",
    //       {
    //         class: "px-4 py-2 bg-green-600 rounded",
    //         onClick: (e) => {
    //           const input = e.target.previousSibling;
    //           if (input.value.trim()) {
    //             sendChat();
    //             input.value = "";
    //           }
    //         },
    //       },
    //       "Send"
    //     )
    //   )
    )
  );
}
