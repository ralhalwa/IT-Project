import { h } from "../../framework/dom.js";
import { navigate } from "../../framework/router.js";
import {
  useState,
  useLocalStorageState,
  useEffect,
} from "../../framework/hooks.js";
import { useErrorPopup, showError } from "../components/ErrorPopup.js";

const host = window.location.hostname;
const WS_PORT = 8081;

// Figure out which logical lobby we are in:
// - Invite links: /bombermario?roomId=302e...
// - Public route: /bombermario  → "public"
const urlParams = new URLSearchParams(window.location.search);
const ROOM_ID = urlParams.get("roomId") || "public";

// Decide protocol based on the page protocol
// If the page is loaded with https → use wss
// If the page is loaded with http → use ws
const isSecure = window.location.protocol === "https:";

const BASE_WS_URL = `${isSecure ? "wss" : "ws"}://${host}:${WS_PORT}`;

// FINAL WS URL with ?roomId=...
const WS_URL = `${BASE_WS_URL}?roomId=${encodeURIComponent(ROOM_ID)}`;



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

export default function BomberMario() {
  const [name, setName] = useLocalStorageState("bm_name", "");
  const [joined, setJoined] = useState(false);
  const [players, setPlayers] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [selectedChar, setSelectedChar] = useLocalStorageState(
    "bm_char",
    "mario"
  );
  const [status, setStatus] = useState("disconnected");

  let socketRef = BomberMario.__socket;
  if (!socketRef) BomberMario.__socket = null;

  function getSocket() {
    return BomberMario.__socket;
  }
  function setSocket(ws) {
    BomberMario.__socket = ws;
    if (typeof window !== "undefined") window.__bm_ws = ws || null;
  }

  // --- helpers to persist/clear our selfId (tab-isolated) ---
  function saveSelfId(id) {
    if (id === undefined || id === null) return;
    try {
      const s = String(id);
      sessionStorage.setItem("bm_selfId", s);
      console.debug("[Lobby] stored bm_selfId (tab) =", s);
    } catch {}
  }

  function clearSelfId() {
    try {
      sessionStorage.removeItem("bm_selfId");
    } catch {}
  }

  function tryDeriveSelfIdFromRoster(list) {
    // If server didn't send selfId yet, derive by nickname in lobby roster
    const me = (name || "").trim().toLowerCase();
    const mine = (Array.isArray(list) ? list : []).find(
      (p) => (p?.name || p?.nickname || "").trim().toLowerCase() === me
    );
    const derived = mine?.id ?? mine?.playerId ?? mine?.uid;
    if (derived !== undefined && derived !== null) saveSelfId(derived);
  }

  function connectAndJoin(nickname) {
    if (
      !nickname ||
      nickname.trim() === "" ||
      nickname.length < 2 ||
      nickname.length > 32
    ) {
      showError("Please enter a nickname!");
      return;
    }
    nickname = nickname.trim().substring(0, 32);

    if (getSocket()) {
      try {
        getSocket().close();
      } catch {}
      setSocket(null);
    }

    setStatus("connecting");
    const ws = new WebSocket(WS_URL);
    setSocket(ws);

    ws.onopen = () => {
      setStatus("connected");
      // send join
      ws.send(
        JSON.stringify({
          type: "join",
    payload: { lobbyId: ROOM_ID, name: nickname, character: selectedChar },
        })
      );
      setJoined(true);
      document
        .getElementById("nickname-input")
        ?.setAttribute("disabled", "true");
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "error") {
          showError(msg.message);
          setJoined(false);
          document
            .getElementById("nickname-input")
            ?.removeAttribute("disabled");
          return;
        }
        handleServerMessage(msg);
      } catch (e) {
        console.warn("invalid server message", ev.data);
      }
    };

    ws.onclose = () => {
      setStatus("disconnected");
      setJoined(false);
      document.getElementById("nickname-input")?.removeAttribute("disabled");
      setSocket(null);
      clearSelfId(); // ✅ clear on disconnect
    };

    ws.onerror = (err) => {
      console.error("WebSocket error", err);
      setStatus("error");
    };
  }

  function handleServerMessage(msg) {
    if (!msg || !msg.type) return;

    if (msg.type === "lobby") {
      const payload = msg.payload || {};
      const list = payload.players || [];
      setPlayers(list);
      setCountdown(payload.countdownUntil || null);

      // try to derive selfId early if possible
      tryDeriveSelfIdFromRoster(list);
    } else if (msg.type === "chat") {
      setChatMessages((prev) => [...prev, msg.payload]);
      } else if (msg.type === "start") {
    const sid = msg?.payload?.selfId;
    if (sid != null) saveSelfId(sid); 

    setStatus("starting");

    // Stop lobby music before entering game
    try {
      const lobbySound = document.getElementById("lobby-sound");
      if (lobbySound) {
        lobbySound.pause();
        lobbySound.currentTime = 0;
      }
    } catch {}

    setTimeout(() => {
      try {
  sessionStorage.setItem("bm_fromLobby", "1");
} catch {}
navigate("/game");

      console.log("START payload:", msg.payload);
    }, 200);
  }

  }

  function sendChat() {
    const ws = getSocket();
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showError("Not connected");
      return;
    }
    if (!chatInput.trim()) return;
    ws.send(JSON.stringify({ type: "chat", payload: { text: chatInput } }));
    setChatInput("");
  }

  function countdownSecondsLeft() {
    if (!countdown) return null;
    const left = Math.max(0, Math.ceil((countdown - Date.now()) / 1000));
    return left;
  }

  useEffect(() => {
    if (!countdown) return;
    const interval = setInterval(() => {
      const left = countdownSecondsLeft();
      if (left <= 0) {
        clearInterval(interval);
        setCountdown(null);
      } else {
        // force repaint
        setCountdown((prev) => prev);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  useEffect(() => {
    const chatBox = document.querySelector("#chat-box");
    if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
  }, [chatMessages]);

  const charCounts = players.reduce((acc, p) => {
    if (p?.character) acc[p.character] = (acc[p.character] || 0) + 1;
    return acc;
  }, {});
  // 🔊 Lobby music lifecycle
  useEffect(() => {
    const audio = document.getElementById("lobby-sound");
    if (!audio) return;

    audio.loop = true;
    audio.volume = 0.4; // tweak if too loud

    audio.play().catch(() => {
      // browser might block autoplay; we'll also try again on first user action
    });

    return () => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    };
  }, []);

  let seen = {};

  return h(
    "div",
    {
      class:
        "min-h-screen flex items-center gap-16 justify-center bg-transparent p-6 text-gray-100",
    },
     // ⬇⬇ BACK BUTTON HERE ⬇⬇
    h(
      "button",
      {
        class:
          "fixed top-4 left-4 z-50 px-3 py-2 rounded-lg bg-gray-900/80 border border-gray-700 text-white text-xs hover:bg-gray-800 transition flex items-center gap-1",
        onClick: () => {
          window.location.href = "/"; // back to Social home
        },
      },
      "← Back"
    ),
    useErrorPopup(),
     h("audio", {
    id: "lobby-sound",
    src: "/audio/LobbySound.mp3",
  }),
    // Players
    h(
      "div",
      {
        class:
          "w-full min-h-[45vh] flex flex-col justify-center max-w-2xl bg-gray-800/70 p-6 rounded-xl border border-gray-700",
      },
      h(
        "div",
        {},
        h("div", { class: "text-sm text-gray-300 mb-1" }, ""),
        h(
          "div",
          { class: "bg-black/50 p-4 rounded-lg border-4 border-gray-600" },
          h(
            "h2",
            { class: "text-lg mb-2 text-center" },
            `PLAYERS ${players.length}/4`
          ),
          h(
            "ul",
            { class: "space-y-2" },
            ...Array(4)
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
                    duplicateIndex = seen[playerChar] - 2;
                  }
                }

                return h(
                  "li",
                  {
                    key: `pl-slot-${i}`,
                    class: `p-3 text-lg border-2 ${
                      player
                        ? player.name === name
                          ? "border-green-500 bg-green-700/40"
                          : "border-blue-400 bg-blue-600/50"
                        : "border-gray-700 text-gray-500"
                    }`,
                  },
                  player
                    ? h(
                        "div",
                        { class: "flex items-center gap-2" },
                        h("img", {
                          src:
                            characters[playerChar || "mario"]?.icon ||
                            "https://placehold.co/48x48",
                          alt: playerChar || "mario",
                          class: `w-16 h-16 border-4 rounded-xl ${
                            isDuplicate
                              ? duplicateColors[
                                  duplicateIndex % duplicateColors.length
                                ]
                              : "border-transparent"
                          }`,
                        }),
                        h(
                          "span",
                          {},
                          `P${i + 1}: ${player.name}`
                        )
                      )
                    : `P${i + 1}: WAITING...`
                );
              })
          )
        ),
        (() => {
  if (countdown === null) return null;
  
  const secondsLeft = countdownSecondsLeft();
  
  return h(
    "div",
    { 
      class: "mt-1 text-sm text-yellow-300", 
      key: "countdown-display",
      "data-seconds": secondsLeft
    },
    `Starting in ${secondsLeft}s`
  );
})()
      )
    ),

    // Join / Leave and character selector
    h(
      "div",
      {
        class:
          "w-[40vw] max-w-2xl text-center bg-gray-800/70 p-6 rounded-xl border border-gray-700",
      },
      h(
        "div",
        { class: "grid grid-cols-1 gap-4 mb-4" },
        h(
          "div",
          {},
          h("label", { class: "block text-sm text-gray-300 mb-1" }, "Nickname"),
          h("input", {
            class:
              "w-full px-3 py-2 placeholder:text-[0.6rem] text-center rounded bg-gray-700 border border-gray-600 text-white",
            value: name,
            id: "nickname-input",
            onInput: (e) => setName(e.target.value),
            placeholder: "Enter a nickname...",
          }),
          !joined
            ? h(
                "div",
                { class: "mt-3" },
                h("h3", { class: "text-[0.6rem] mb-2" }, "SELECT CHARACTER"),
                h(
                  "div",
                  { class: "grid grid-cols-4 gap-2 mb-6" },
                  ...Object.keys(characters).map((charKey) =>
                    h(
                      "button",
                      {
                        key: charKey,
                        class: ` border-4 rounded-xl ${
                          selectedChar === charKey
                            ? "border-blue-400 bg-blue-600"
                            : "border-gray-500 bg-gray-700"
                        }`,
                        onClick: () => setSelectedChar(charKey),
                      },
                      h("img", {
                        src: characters[charKey].icon,
                        alt: characters[charKey].name,
                        class: "rounded-lg",
                      })
                    )
                  )
                ),
                h(
                  "button",
                  {
                    class: "px-4 py-2 bg-blue-600 rounded hover:bg-blue-700",
                    onClick: () => connectAndJoin(name),
                  },
                  "Join Lobby"
                )
              )
            : h(
                "div",
                { class: "mt-3" },
                h(
                  "button",
                  {
                    class: "px-4 py-2 bg-red-600 rounded hover:bg-red-700",
                    onClick: () => {
                      const ws = getSocket();
                      if (ws) ws.close();
                      setSocket(null);
                      clearSelfId(); // ✅ clear id on leave
                      setJoined(false);
                      document
                        .getElementById("nickname-input")
                        ?.removeAttribute("disabled");
                      setPlayers([]);
                      setCountdown(null);
                    },
                  },
                  "Leave"
                )
              )
        )
      ),
      h(
        "div",
        {
          class:
            "flex justify-between items-center text-[0.55rem] text-gray-400",
        },
        h("div", {}, `Connection: ${status}`),
h("div", {}, `Lobby: ${ROOM_ID}`)
      )
    ),

    // Lobby chat
    h(
      "div",
      {
        class:
          "w-full h-[45vh] flex flex-col justify-center max-w-2xl bg-gray-800/70 p-6 rounded-xl border border-gray-700",
      },
      h(
        "div",
        { class: "mb-4" },
        h("div", { class: "text-sm text-gray-300 mb-2" }, "Lobby Chat"),
        h(
          "div",
          {
            id: "chat-box",
            class:
              "h-[30vh] overflow-auto p-2 bg-gray-900 border border-gray-700 rounded",
          },
          ...chatMessages.map((m, idx) =>
            h(
              "div",
              { key: `chat-${idx}`, class: "text-xs" },
              `${new Date(m.ts).toLocaleTimeString()} ${m.from}: ${m.text}`
            )
          )
        ),
        h(
          "div",
          { class: "mt-2 flex gap-2" },
          h("input", {
            class:
              "flex-1 px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white",
            placeholder: "Say something...",
            value: chatInput,
            onInput: (e) => setChatInput(e.target.value),
            onKeydown: (e) => {
              if (e.key === "Enter" && e.target.value.trim()) {
                sendChat();
                e.target.value = "";
              }
            },
          }),
          h(
            "button",
            {
              class: "px-4 py-2 bg-green-600 rounded",
              onClick: (e) => {
                const input = e.target.previousSibling;
                if (input.value.trim()) {
                  sendChat();
                  input.value = "";
                }
              },
            },
            "Send"
          )
        )
      )
    )
  );

  function broadcastLocalDebug(currentPlayers) {
    console.log("Local debug: players=", currentPlayers);
    showError(`Local debug: ${currentPlayers.length} players (see console)`);
  }
}
