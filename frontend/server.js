// server.js
import { WebSocketServer, WebSocket } from "ws";

const PORT = 8081;
const wss = new WebSocketServer({ port: PORT });

console.log(
  `WebSocket server starting on ws://localhost:${PORT} (logging enabled)`
);

// Lobby state
let nextId = 1;
const players = new Map(); // ws -> { id, name, joinedAt }
let countdown = null; // {until: timestamp}
let countdownTimer = null;

// Helper: broadcast JSON to all connected clients
function broadcast(obj) {
  const raw = JSON.stringify(obj);
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(raw);
    }
  });
}

// Send lobby snapshot
function broadcastLobby() {
  const list = Array.from(players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    character: p.character,
  }));

  const payload = {
    players: list,
    countdownUntil: countdown ? countdown.until : null,
  };

  broadcast({ type: "lobby", payload });
  log(
    `Lobby update → ${list.length} player(s). countdown=${
      payload.countdownUntil || "none"
    }`
  );
}

// Logging helper
function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

// Countdown helpers
function startCountdown(ms) {
  clearCountdown();
  const until = Date.now() + ms;
  countdown = { until };
  log(
    `Starting countdown: ${ms / 1000}s (until=${new Date(until).toISOString()})`
  );
  broadcastLobby();

  countdownTimer = setTimeout(() => {
    countdownTimer = null;
    countdown = null;
    startGame();
  }, ms);
}

function clearCountdown() {
  if (countdownTimer) {
    clearTimeout(countdownTimer);
    countdownTimer = null;
  }
  countdown = null;
}

// Determine and update countdown rules according to lobby size
function evaluateCountdownRules() {
  const count = players.size;

  if (count < 2) {
    if (countdown) {
      log("Not enough players (<2). Canceling countdown.");
      clearCountdown();
      broadcastLobby();
    }
    return;
  }

  if (countdown) {
    if (count === 4) {
      const remaining = countdown.until - Date.now();
      if (remaining > 10000) {
        log("4 players reached — shorten countdown to 10s");
        clearCountdown();
        startCountdown(10000);
      }
    }
    return;
  }

  if (!countdown && count >= 2) {
    log("At least 2 players - starting 20s countdown");
    startCountdown(20000);
  }
}

// Start game
function startGame() {
  const list = Array.from(players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    character: p.character,
  }));
  const selected = list.slice(0, 4);
  const payload = { players: selected, gameId: `game-${Date.now()}` };
  log("Starting game with players:", selected.map((p) => p.name).join(", "));
  broadcast({ type: "start", payload });
  players.clear();
  clearCountdown();
  broadcastLobby();
}

// Broadcast chat
function broadcastChat(from, text) {
  const payload = { from, text, ts: Date.now() };
  broadcast({ type: "chat", payload });
}

// WebSocket connection handling
wss.on("connection", (ws) => {
  ws._created = Date.now();
  log("Client connected");

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      log("Invalid JSON from client:", raw);
      return;
    }
    const { type, payload } = msg;

    if (type === "join") {
      let requested = payload?.name
        ? String(payload.name).slice(0, 32).trim()
        : "";
      if (!requested) requested = `p${nextId}`;
      const character = payload?.character || "mario";

      // ✅ Check if that name is taken
      const taken = Array.from(players.values()).some(
        (p) => p.name.toLowerCase() === requested.toLowerCase()
      );

      if (taken) {
        ws.send(
          JSON.stringify({ type: "error", message: "Nickname already taken" })
        );
        return; // do not register
      }

      const id = nextId++;
      players.set(ws, { id, name: requested, character, joinedAt: Date.now() });
      log(
        `Player join: ${requested} as ${character} (id=${id}), total=${players.size}`
      );
      broadcastLobby();
      evaluateCountdownRules();
    } else if (type === "chat") {
      const entry = players.get(ws);
      const from = entry ? entry.name : "anon";
      const text = String(payload?.text ?? "").slice(0, 300);
      log(`Chat from ${from}: ${text}`);
      broadcastChat(from, text);
    } else if (type === "ready") {
      log("Client ready message received");
    } else {
      log("Unknown msg type:", type);
    }
  });

  ws.on("close", () => {
    const p = players.get(ws);
    if (p) {
      log(`Player disconnected: ${p.name} (id=${p.id})`);
      players.delete(ws);
      broadcastLobby();
      evaluateCountdownRules();
    } else {
      log("An unregistered client disconnected");
    }
  });

  ws.on("error", (err) => {
    log("WS error:", err?.message);
  });

  // send current lobby snapshot immediately
  broadcastLobby();
});

log("Server listening on port", PORT);
