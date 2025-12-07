import { WebSocketServer, WebSocket } from "ws";
import { useEffect } from "./framework/hooks.js";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ---------- Map generator ----------
export const GRID_COLS = 13;
export const GRID_ROWS = 11;
export const WALL_COLS = 6;
export const WALL_ROWS = 5;
export const CELL_SIZE = 62;
let gameInProgress = false;
const playerPositions = new Map(); // id -> { r, c, dir }
const playerLives = new Map(); // id -> lives
const playerStatus = new Map();
const lastHitTime = new Map(); // id -> timestamp of last damage
const HIT_COOLDOWN = 300; // 1 second debounce window

const playerPowerups = new Map();
// --- Block respawn tuning ---
const RESPAWN_MIN_MS = 60000; // 30s
const RESPAWN_MAX_MS = 60000; // 30s (no jitter)
const TELEGRAPH_MS = 1200; // 1.2s warning before block appears
const RESPAWN_TICK_MS = 300; // scheduler tick
const RESPAWN_POWERC_UP_CHANCE = 0.08; // 8% chance (lower than initial gen)
const RESPAWN_BACKOFF_MS = 3000; // retry after 3s if ineligible

// queued jobs: { r, c, dueAt, tries }
const respawnQueue = [];

export function generateMap() {
  const map = [];

  // Initialize map with border cells
  for (let row = 0; row < GRID_ROWS; row++) {
    map[row] = [];
    for (let col = 0; col < GRID_COLS; col++) {
      if (
        row === 0 ||
        row === GRID_ROWS - 1 ||
        col === 0 ||
        col === GRID_COLS - 1
      ) {
        map[row][col] = { type: "border", row, col };
      } else {
        map[row][col] = { type: "empty", row, col };
      }
    }
  }

  // Place fixed walls
  const wallStartX = 2;
  const wallStartY = 2;

  for (let wallRow = 0; wallRow < WALL_ROWS; wallRow++) {
    for (let wallCol = 0; wallCol < WALL_COLS; wallCol++) {
      const x = wallStartX + wallCol * 2;
      const y = wallStartY + wallRow * 2;
      if (x < GRID_COLS - 1 && y < GRID_ROWS - 1) {
        map[y][x] = { type: "wall", row: y, col: x };
      }
    }
  }

  // Safe zones around players start position
  const safeZones = [
    { x: 1, y: 1 },
    { x: GRID_COLS - 2, y: 1 },
    { x: 1, y: GRID_ROWS - 2 },
    { x: GRID_COLS - 2, y: GRID_ROWS - 2 },
  ];

  // Surrounding cells to safe zones
  const extendedSafeZones = [];
  safeZones.forEach((zone) => {
    extendedSafeZones.push(zone);
    extendedSafeZones.push({ x: zone.x, y: zone.y + 1 });
    extendedSafeZones.push({ x: zone.x + 1, y: zone.y });
    extendedSafeZones.push({ x: zone.x - 1, y: zone.y });
    extendedSafeZones.push({ x: zone.x, y: zone.y - 1 });
  });

  const blockProbability = 0.5;
  const powerupProbability = 0.6;

  for (let row = 1; row < GRID_ROWS - 1; row++) {
    for (let col = 1; col < GRID_COLS - 1; col++) {
      const cell = map[row][col];
      const isSafeZone = extendedSafeZones.some(
        (zone) => zone.x === col && zone.y === row
      );
      if (
        cell.type === "empty" &&
        !isSafeZone &&
        Math.random() < blockProbability
      ) {
        const hasPowerup = Math.random() < powerupProbability;
        const powerupTypes = ["bomb", "flame", "speed", "life"];
        const powerupType = hasPowerup
          ? powerupTypes[Math.floor(Math.random() * powerupTypes.length)]
          : null;

        map[row][col] = {
          type: "block",
          row,
          col,
          hasPowerup: hasPowerup,
          powerupType: powerupType,
        };
      }
    }
  }

  return map;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- HTTPS + WSS ----
const PORT = 8081;
const wss = new WebSocketServer({ port: PORT });
console.log(
  `WebSocket server starting on ws://localhost:${PORT} (logging enabled)`
);

// server.listen(PORT, () => {
//   console.log(
//     `✅ Secure WebSocket server running on wss://yourdomain.com:${PORT}`
//   );
// });  
// console.log(
//   `WebSocket server starting on ws://localhost:${PORT} (logging enabled)`
// );

// ---- State ----
let nextId = 1;
const players = new Map(); // ws -> { id, name, character, joinedAt }
const idToWs = new Map(); // id -> ws
let countdown = null; // { until: ts }
let countdownTimer = null;
let currentMap = null; // <-- the authoritative game map

// ---- Player Position Management ----
function initializePlayerPositions(playersList, gameMap) {
  const R = gameMap.length;
  const C = gameMap[0].length;
  const seeds = [
    { r: 1, c: 1 },
    { r: 1, c: C - 2 },
    { r: R - 2, c: 1 },
    { r: R - 2, c: C - 2 },
  ];

  playersList.forEach((player, index) => {
    const seed = seeds[index % seeds.length];
    playerPositions.set(player.id, {
      r: seed.r,
      c: seed.c,
      dir: "down",
    });
  });
}

function broadcastAllPlayerPositions() {
  const allPositions = {};
  playerPositions.forEach((pos, id) => {
    const player = players.get(idToWs.get(id));
    if (player) {
      allPositions[player.name] = pos;
    }
  });

  broadcast({
    type: "all-positions",
    payload: { positions: allPositions },
  });
}

// ---- Explosion Logic ----
function calculateExplosionPattern(centerR, centerC, range, gameMap) {
  const cells = [{ r: centerR, c: centerC }]; // center cell

  // Directions: up, down, left, right
  const directions = [
    { r: -1, c: 0 }, // up
    { r: 1, c: 0 }, // down
    { r: 0, c: -1 }, // left
    { r: 0, c: 1 }, // right
  ];

  directions.forEach((dir) => {
    for (let i = 1; i <= range; i++) {
      const r = centerR + dir.r * i;
      const c = centerC + dir.c * i;

      // Stop if out of bounds
      if (r < 0 || r >= gameMap.length || c < 0 || c >= gameMap[0].length)
        break;

      const cell = gameMap[r]?.[c];

      // Stop if we hit a wall or border (unbreakable)
      if (cell?.type === "wall" || cell?.type === "border") break;

      cells.push({ r, c });

      // Stop if we hit a breakable block (destroy it but don't continue)
      if (cell?.type === "block") break;
    }
  });

  return cells;
}

function destroyBlocksInExplosion(explosionCells) {
  if (!currentMap) return;

  let destroyedBlocks = 0;

  explosionCells.forEach(({ r, c }) => {
    if (currentMap[r]?.[c]?.type === "block") {
      const block = currentMap[r][c];

      // Check if block has powerup
      if (block.hasPowerup && block.powerupType) {
        currentMap[r][c] = {
          type: "powerup",
          row: r,
          col: c,
          powerupType: block.powerupType,
          destroyable: false,
          walkable: true,
        };
      } else {
        // Regular block becomes empty
        currentMap[r][c] = {
          type: "empty",
          row: r,
          col: c,
          walkable: true,
        };
      }

      // schedule respawn of this destroyed block
      scheduleBlockRespawn(r, c);

      destroyedBlocks++;
    }
  });

  if (destroyedBlocks > 0) {
    broadcast({ type: "map-update", payload: { map: currentMap } });
  }
}

function checkGameOver() {
  if (!gameInProgress) return;

  // Get all alive players
  const alivePlayers = Array.from(playerStatus.entries())
    .filter(([id, status]) => status != "dead")
    .map(([id]) => id);

  log(`Checking game over: ${alivePlayers} players alive`);
  if (alivePlayers.length === 0) {
    // everyone dead or disconnected
    log("⚰️ All players are dead or gone — game over (no winner)");
    endGame(null);
    return;
  }

  if (alivePlayers.length === 1) {
    const winnerId = alivePlayers[0];
    const winner = Array.from(players.values()).find((p) => p.id === winnerId);
    if (winner) {
      log(`🏆 Game Over — Winner: ${winner.name}`);
      endGame(winner);
    } else {
      // if the last player disconnected before we checked
      log("🏁 Last player disconnected before win detected");
      endGame(null);
    }
  }
}

function endGame(winner) {
  if (!gameInProgress) return;
  gameInProgress = false;

  const payload = {
    winner: winner
      ? { id: winner.id, name: winner.name, character: winner.character }
      : null,
    reason: winner ? "win" : "all-dead",
  };

  broadcast({ type: "game-over", payload });

  log(
    `🎮 Game over broadcasted — ${
      winner ? `Winner: ${winner.name}` : "No survivors"
    }`
  );

  // Optionally reset all transient game state
  playerPositions.clear();
  playerLives.clear();
  playerStatus.clear();
  currentMap = null;
  countdown = null;
  clearCountdown();

  // Give clients time to see the screen before lobby restarts
  setTimeout(() => {
    broadcastLobby();
  }, 3000);
}

// ---- Utils ----
function log(...args) {
  console.log(new Date().toISOString(), ...args);
}
// --- Respawn helpers ---
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isInSpawnSafeZone(r, c) {
  const C = GRID_COLS,
    R = GRID_ROWS;
  const seeds = [
    { r: 1, c: 1 },
    { r: 1, c: C - 2 },
    { r: R - 2, c: 1 },
    { r: R - 2, c: C - 2 },
  ];
  for (const s of seeds) {
    if (
      (r === s.r && c === s.c) ||
      (r === s.r + 1 && c === s.c) ||
      (r === s.r - 1 && c === s.c) ||
      (r === s.r && c === s.c + 1) ||
      (r === s.r && c === s.c - 1)
    ) {
      return true;
    }
  }
  return false;
}

function isPlayerAt(r, c) {
  for (const pos of playerPositions.values()) {
    if (pos.r === r && pos.c === c) return true;
  }
  return false;
}

function isWalkableCell(cell) {
  if (!cell) return false;
  return (
    cell.type === "empty" ||
    cell.type === "powerup" ||
    cell.type === "telegraph"
  );
}

function neighbors4(r, c) {
  return [
    { r: r - 1, c },
    { r: r + 1, c },
    { r, c: c - 1 },
    { r, c: c + 1 },
  ];
}

function wouldHardTrapPlayer(r, c) {
  for (const [id, pos] of playerPositions.entries()) {
    const dist = Math.abs(pos.r - r) + Math.abs(pos.c - c);
    if (dist === 1) {
      let open = 0;
      for (const nb of neighbors4(pos.r, pos.c)) {
        if (nb.r === r && nb.c === c) continue;
        const cell = currentMap?.[nb.r]?.[nb.c];
        if (isWalkableCell(cell)) open++;
      }
      if (open === 0) return true;
    }
  }
  return false;
}

function isEligibleRespawnCell(r, c) {
  if (!currentMap) return false;
  if (r <= 0 || c <= 0 || r >= GRID_ROWS - 1 || c >= GRID_COLS - 1)
    return false;
  const cell = currentMap[r]?.[c];
  if (!cell) return false;
  if (!(cell.type === "empty" || cell.type === "telegraph")) return false;
  if (isPlayerAt(r, c)) return false;
  if (isInSpawnSafeZone(r, c)) return false;
  if (wouldHardTrapPlayer(r, c)) return false;
  return true;
}

function scheduleBlockRespawn(
  r,
  c,
  delayMs = randInt(RESPAWN_MIN_MS, RESPAWN_MAX_MS)
) {
  respawnQueue.push({ r, c, dueAt: Date.now() + delayMs, tries: 0 });
}

function sendTo(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

function broadcast(obj) {
  const raw = JSON.stringify(obj);
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) c.send(raw);
  });
}

function snapshotPlayers() {
  return Array.from(players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    character: p.character,
    lives: playerLives.get(p.id) ?? 3, // include lives in snapshots
  }));
}

function broadcastLobby() {
  const payload = {
    players: snapshotPlayers(),
    countdownUntil: countdown ? countdown.until : null,
  };
  broadcast({ type: "lobby", payload });
  log(
    `Lobby update → ${payload.players.length} player(s). countdown=${
      payload.countdownUntil || "none"
    }`
  );
}

// ---- Countdown ----
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
    log("At least 2 players - starting 30s countdown");
    startCountdown(30000);
  }
}

//handle powerup collection
function collectPowerup(playerId, powerupType, r, c) {
  if (!playerPowerups.has(playerId)) {
    playerPowerups.set(playerId, { bomb: 0, flame: 0, speed: 0, life: 0 });
  }

  const playerPowers = playerPowerups.get(playerId);
  playerPowers[powerupType] = (playerPowers[powerupType] || 0) + 1;

  //remove powerup from map
  if (currentMap && currentMap[r]?.[c]?.type === "powerup") {
    currentMap[r][c] = {
      type: "empty",
      row: r,
      col: c,
      walkable: true,
    };
    let expiresAt = Date.now() + 10000; // 10 seconds base

    // If player already has this powerup and it's speed type, extend duration
    const existingCount = playerPowers[powerupType] - 1;
    if (powerupType === "speed" && existingCount > 0) {
      expiresAt = Date.now() + 10000; //extend by another 10s
    }

    // Broadcast updated map and powerup collection
    broadcast({
      type: "map-update",
      payload: { map: currentMap },
    });

    broadcast({
      type: "powerup-collected",
      payload: {
        playerId: playerId,
        playerName: players.get(idToWs.get(playerId))?.name,
        powerupType: powerupType,
        r: r,
        c: c,
        newCount: playerPowers[powerupType],
      },
    });
    scheduleBlockRespawn(r, c);
    // health powerup effect
    if (powerupType === "life") {
      const cur = playerLives.get(playerId) ?? 3;
      if (cur < 3) {
        const next = Math.min(3, cur + 1);
        playerLives.set(playerId, next);
        broadcast({
          type: "lives-update",
          payload: { id: playerId, lives: next, reason: "life-powerup" },
        });
      }
    }
  }
}

// ---- Game lifecycle ----
function startGame() {
  gameInProgress = true;
  const list = snapshotPlayers().slice(0, 4);
  currentMap = generateMap(); // <-- create map
  list.forEach((p) => playerLives.set(p.id, 3));
  broadcast({
    type: "lives-bulk",
    payload: list.map((p) => ({ id: p.id, lives: 3 })),
  });
  // INITIALIZE PLAYER POSITIONS
  initializePlayerPositions(list, currentMap);

  const payload = {
    players: list,
    gameId: `game-${Date.now()}`,
    map: currentMap, // <-- include map
  };

  log("Starting game with players:", list.map((p) => p.name).join(", "));
  broadcast({ type: "start", payload });

  // BROADCAST INITIAL POSITIONS TO ALL CLIENTS
  broadcastAllPlayerPositions();

  clearCountdown();
  broadcastLobby();
}

function sendState(ws) {
  const payload = {
    players: snapshotPlayers().slice(0, 4),
    map: currentMap,
  };
  sendTo(ws, { type: "state", payload });
}

// ---- Chat ----
function broadcastChat(from, text) {
  const payload = { from, text, ts: Date.now() };
  broadcast({ type: "chat", payload });
}

// ---- Connection handling ----
wss.on("connection", (ws) => {
  ws._created = Date.now();
  log("Client connected");

  // Send current lobby immediately
  sendTo(ws, {
    type: "lobby",
    payload: {
      players: snapshotPlayers(),
      countdownUntil: countdown ? countdown.until : null,
    },
  });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      log("Invalid JSON from client:", raw);
      return;
    }

    const { type, payload } = msg;

    if (type === "join") {
      if (players.size === 0 && gameInProgress) {
        console.log("All players disconnected. Ending game.");
        gameInProgress = false;
      }
      if (gameInProgress) {
        ws.send(
          JSON.stringify({
            type: "error",
            message:
              "A game is already in progress. Please wait for the next round.",
          })
        );
        ws.close();
        return;
      }
      let requested = payload?.name
        ? String(payload.name).slice(0, 32).trim()
        : "";
      if (!requested) requested = `p${nextId}`;
      const character = payload?.character || "mario";

      // name checks
      const taken = Array.from(players.values()).some(
        (p) => p.name.toLowerCase() === requested.toLowerCase()
      );
      if (taken)
        return sendTo(ws, { type: "error", message: "Nickname already taken" });

      if (requested.length < 3 || requested.length > 8)
        return sendTo(ws, {
          type: "error",
          message: "Nickname has to be between 3-8 characters",
        });

      if (requested.includes(" "))
        return sendTo(ws, {
          type: "error",
          message: "Nickname cannot contain spaces",
        });

      const id = nextId++;
      ws._id = id;
      players.set(ws, { id, name: requested, character, joinedAt: Date.now() });
      idToWs.set(id, ws);
      playerLives.set(id, 3);
      playerStatus.set(id, "alive");
      broadcast({
        type: "lives-update",
        payload: { id, lives: 3, reason: "join" },
      });

      log(
        `Player join: ${requested} as ${character} (id=${id}), total=${players.size}`
      );
      broadcastLobby();
      evaluateCountdownRules();
      return;
    }

    if (type === "move") {
      const from = players.get(ws);
      if (!from) return;
      const { r, c, dir } = payload;

      // Store player position
      playerPositions.set(from.id, { r, c, dir });

      // BROADCAST POSITION UPDATE TO ALL CLIENTS
      broadcast({
        type: "player-move",
        payload: {
          id: from.id,
          name: from.name,
          r,
          c,
          dir,
        },
      });

      //check if player is on powerup, then he collects it
      if (currentMap && currentMap[r]?.[c]?.type === "powerup") {
        const powerupType = currentMap[r][c].powerupType;
        if (powerupType) {
          collectPowerup(from.id, powerupType, r, c);
        }
      }
      return;
    }

    // request all positions
    if (type === "request-positions") {
      broadcastAllPlayerPositions();
      return;
    }

    if (type === "chat") {
      const entry = players.get(ws);
      const from = entry ? entry.name : "anon";
      const text = String(payload?.text ?? "").slice(0, 300);
      log(`Chat from ${from}: ${text}`);
      broadcastChat(from, text);
      return;
    }

    // ---- BOMB PLACEMENT ----
    if (type === "place-bomb") {
      const from = players.get(ws);
      if (!from) return;
      const status = playerStatus.get(from.id);
      if (status === "dead") return;

      const { r, c, owner, ownerId } = payload;
      // Broadcast to all clients
      broadcast({
        type: "bomb-placed",
        payload: {
          r,
          c,
          owner: from.name,
          id: `bomb-${Date.now()}-${from.id}`,
          fuseMs: 2000,
        },
      });
      return;
    }

    // ---- BOMB EXPLOSION ----
    if (type === "bomb-explode") {
      const from = players.get(ws);
      if (!from) return;
      const status = playerStatus.get(from.id);
      if (status === "dead") return;

      const { r, c, range = 1 } = payload;

      // Validate coordinates and map
      if (typeof r !== "number" || typeof c !== "number") {
        return;
      }

      if (!currentMap) {
        return;
      }

      console.log(
        `💥 SERVER received bomb explosion from ${from.name} at (${r}, ${c}) with range ${range}`
      );

      // Calculate explosion pattern (up, down, left, right)
      const explosionCells = calculateExplosionPattern(r, c, range, currentMap);

      // Update the server's authoritative map (destroy blocks)
      destroyBlocksInExplosion(explosionCells);

      // Broadcast explosion to all clients
      broadcast({
        type: "bomb-explode",
        payload: {
          r,
          c,
          range,
          explosionCells,
          explodedBy: from.name,
        },
      });
      return;
    }

    // ---- STATE / SYNC MESSAGES ----
    if (type === "game-state") {
      // send current state.
      sendState(ws);
      return;
    }

    if (type === "request-map") {
      if (!currentMap) {
        currentMap = generateMap();
      }
      sendTo(ws, { type: "map", payload: { map: currentMap } });
      return;
    }

    if (type === "request-players") {
      sendTo(ws, {
        type: "players",
        payload: { players: snapshotPlayers().slice(0, 4) },
      });
      return;
    }

    if (type === "map-update") {
      const m = payload?.map;
      if (Array.isArray(m) && m.length) {
        currentMap = m;
        broadcast({ type: "map-update", payload: { map: currentMap } });
      }
      return;
    }
    if (type === "request-lives") {
      const pack = Array.from(players.values()).map((p) => ({
        id: p.id,
        lives: playerLives.get(p.id) ?? 3,
      }));
      sendTo(ws, { type: "lives-bulk", payload: pack });
      return;
    }

    if (type === "lose-life") {
      const from = players.get(ws);
      if (!from) return;
      const status = playerStatus.get(from.id);
      if (status === "dead") return;
      const now = Date.now();
      const last = lastHitTime.get(from.id) || 0;

      // ignore hits too close together
      if (now - last < HIT_COOLDOWN) {
        console.log(
          `Ignored rapid hit from ${from.name} (${now - last}ms since last)`
        );
        return;
      }
      lastHitTime.set(from.id, now);
      const cur = playerLives.get(from.id) ?? 3;
      const next = Math.max(0, cur - 1);
      if (next === cur) return;

      playerLives.set(from.id, next);
      console.log(
        `❤️ ${from.name} lost a life -> ${next} (reason: ${
          payload?.reason || "unknown"
        })`
      );

      broadcast({
        type: "lives-update",
        payload: { id: from.id, lives: next, reason: payload?.reason || "hit" },
      });

      if (next <= 0) {
        playerStatus.set(from.id, "dead");
        broadcast({
          type: "player-dead",
          payload: { id: from.id, name: from.name },
        });

        broadcast({
          type: "spectate-mode",
          payload: { id: from.id, name: from.name },
        });

        log(`💀 ${from.name} is now spectating`);
      }
      checkGameOver();
      return;
    }

    // ---- WebRTC signaling passthrough ----
    if (type === "rtc-offer") {
      const toId = payload?.toId;
      const fromId = players.get(ws)?.id;
      const sdp = payload?.sdp;
      const target = idToWs.get(toId);
      if (target && target.readyState === WebSocket.OPEN) {
        target.send(
          JSON.stringify({ type: "rtc-offer", payload: { fromId, sdp } })
        );
      }
      return;
    }

    if (type === "rtc-answer") {
      const toId = payload?.toId;
      const fromId = players.get(ws)?.id;
      const sdp = payload?.sdp;
      const target = idToWs.get(toId);
      if (target && target.readyState === WebSocket.OPEN) {
        target.send(
          JSON.stringify({ type: "rtc-answer", payload: { fromId, sdp } })
        );
      }
      return;
    }

    if (type === "rtc-ice") {
      const toId = payload?.toId;
      const fromId = players.get(ws)?.id;
      const candidate = payload?.candidate;
      const target = idToWs.get(toId);
      if (target && target.readyState === WebSocket.OPEN) {
        target.send(
          JSON.stringify({ type: "rtc-ice", payload: { fromId, candidate } })
        );
      }
      return;
    }

    if (type === "collect-powerup") {
      const from = players.get(ws);
      if (!from) return;

      const { r, c, powerupType } = payload;

      // Verify the cell actually has this powerup
      if (
        currentMap &&
        currentMap[r]?.[c]?.type === "powerup" &&
        currentMap[r][c].powerupType === powerupType
      ) {
        collectPowerup(from.id, powerupType, r, c);
      }
      return;
    }

    log("Unknown msg type:", type);
  });

  ws.on("close", () => {
    const p = players.get(ws);
    if (p) {
      playerStatus.set(p.id, "dead");
      playerPositions.delete(p.id);
      idToWs.delete(p.id);
      players.delete(ws);
      log(`Player disconnected: ${p.name} (id=${p.id})`);

      broadcastLobby();
      evaluateCountdownRules();
      if (gameInProgress) checkGameOver();
    } else {
      log("An unregistered client disconnected");
    }
  });

  ws.on("error", (err) => {
    log("WS error:", err?.message);
  });
});
// --- Respawn scheduler ---
setInterval(() => {
  if (!currentMap || respawnQueue.length === 0) return;

  const now = Date.now();
  const pending = respawnQueue.splice(0, respawnQueue.length);

  for (const job of pending) {
    if (job.dueAt > now) {
      respawnQueue.push(job);
      continue;
    }

    const { r, c } = job;

    if (!isEligibleRespawnCell(r, c)) {
      if (job.tries < 5) {
        job.tries++;
        job.dueAt = now + RESPAWN_BACKOFF_MS;
        respawnQueue.push(job);
      }
      continue;
    }

    // Telegraph warning
    currentMap[r][c] = {
      type: "telegraph",
      row: r,
      col: c,
      walkable: true,
    };
    broadcast({ type: "map-update", payload: { map: currentMap } });

    // Finalize after TELEGRAPH_MS
    setTimeout(() => {
      if (!isEligibleRespawnCell(r, c)) return;

      const hasPowerup = Math.random() < RESPAWN_POWERC_UP_CHANCE;
      const powerupTypes = ["bomb", "flame", "speed", "life"];
      const powerupType = hasPowerup
        ? powerupTypes[Math.floor(Math.random() * powerupTypes.length)]
        : null;

      currentMap[r][c] = {
        type: "block",
        row: r,
        col: c,
        destroyable: true,
        hasPowerup,
        powerupType,
      };

      broadcast({ type: "map-update", payload: { map: currentMap } });
    }, TELEGRAPH_MS);
  }
}, RESPAWN_TICK_MS);

log("Server listening on port", PORT);
