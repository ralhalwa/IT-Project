// src/Pages/bomberman.js
import { h } from "../../framework/dom.js";
import { navigate } from "../../framework/router.js";
import {
  useState,
  useLocalStorageState,
  useEffect,
} from "../../framework/hooks.js";

const host = window.location.hostname;
const WS_URL = `ws://${host}:8081`;

const characters = {
  mario: { name: "Mario", icon: "./assets/Characters/icons/Mario.png" },
  peach: { name: "Peach", icon: "./assets/Characters/icons/Peach.png" },
  yoshi: { name: "Yoshi", icon: "./assets/Characters/icons/Yoshi.png" },
  toadette: { name: "Toadette", icon: "./assets/Characters/icons/Toadette.png"},
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
  const [countdown, setCountdown] = useState(null); // timestamp ms
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [selectedChar, setSelectedChar] = useLocalStorageState(
    "bm_char",
    "mario"
  );
  const [status, setStatus] = useState("disconnected");

  // ws kept in closure
  let socketRef = BomberMario.__socket;
  if (!socketRef) BomberMario.__socket = null;

  // ensure a shared socket object reference so reconnection logic works
  function getSocket() {
    return BomberMario.__socket;
  }
  function setSocket(ws) {
    BomberMario.__socket = ws;
  }

  // Connect or reconnect
  function connectAndJoin(nickname) {
    if (
      !nickname ||
      nickname.trim() === "" ||
      nickname.length < 2 ||
      nickname.length > 32
    ) {
      alert("Please enter a nickname");
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
          payload: {
            name: nickname,
            character: selectedChar, // ✅ include character
          },
        })
      );
      setJoined(true);
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "error") {
          alert(msg.message);
          setJoined(false);
          setName("");
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
      // attempt reconnect after a short delay (only if desired)
      // setTimeout(() => connectAndJoin(nickname), 2000);
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
      setPlayers(payload.players || []);
      setCountdown(payload.countdownUntil || null);
    } else if (msg.type === "chat") {
      setChatMessages((prev) => [...prev, msg.payload]);
    } else if (msg.type === "start") {
      // Game starting - payload includes players and gameId
      setStatus("starting");
      // small UX: navigate to /bomberman/game or show "Starting..." — for now we just show a message
      setTimeout(() => {
        // you can change this to navigate to actual game route
        navigate("/game");
        console.log("START payload:", msg.payload);
        // keep UI stable, or clear lobby UI
      }, 200);
    }
    
  }

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

  // small countdown UI helper
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
        setCountdown((prev) => prev);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [countdown]);

  // Auto-scroll chat to bottom when new messages appear
  useEffect(() => {
    const chatBox = document.querySelector("#chat-box");
    if (chatBox) {
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  }, [chatMessages]);

  const charCounts = players.reduce((acc, p) => {
    if (p?.character) acc[p.character] = (acc[p.character] || 0) + 1;
    return acc;
  }, {});

  let seen = {}; // ✅ track duplicates across all rows

  // UI
  return h(
    "div",
    {
      class:
        "min-h-screen flex items-center gap-16 justify-center bg-transparent p-6 text-gray-100",
    },
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
                    // first duplicate gets index 0
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
                          `P${i + 1}: ${player.name} (${
                            characters[playerChar || "mario"]?.name
                          })`
                        )
                      )
                    : `P${i + 1}: WAITING...`
                );
              })
          )
        ),
        h(
          "div",
          { class: "mt-1 text-sm text-yellow-300", key: "countdown" }, // keyed to avoid duplicates
          countdown !== null ? `Starting in ${countdownSecondsLeft()}s` : ""
        )
      )
    ),
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
                      // close socket and leave
                      const ws = getSocket();
                      if (ws) ws.close();
                      setSocket(null);
                      setJoined(false);
                      setPlayers([]);
                      setCountdown(null);
                    },
                  },
                  "Leave"
                )
              )
        )
      ),

      // Status + helpers
      h(
        "div",
        {
          class:
            "flex justify-between items-center text-[0.55rem] text-gray-400",
        },
        h("div", {}, `Connection: ${status}`)
      )
    ),
    h(
      "div",
      {
        class:
          "w-full h-[45vh] flex flex-col justify-center  max-w-2xl bg-gray-800/70 p-6 rounded-xl border border-gray-700",
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

  // helper debug function (doesn't send server messages, just for dev)
  function broadcastLocalDebug(currentPlayers) {
    console.log("Local debug: players=", currentPlayers);
    alert(`Local debug: ${currentPlayers.length} players (see console)`);
  }
}
