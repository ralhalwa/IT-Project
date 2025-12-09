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
const HIT_COOLDOWN = 300; // 1 second debounce window
const MAX_PLAYERS_PER_LOBBY = 4; 

// --- Block respawn tuning ---
const RESPAWN_MIN_MS = 60000; // 30s
const RESPAWN_MAX_MS = 60000; // 30s (no jitter)
const TELEGRAPH_MS = 1200; // 1.2s warning before block appears
const RESPAWN_TICK_MS = 300; // scheduler tick
const RESPAWN_POWERC_UP_CHANCE = 0.08; // 8% chance (lower than initial gen)
const RESPAWN_BACKOFF_MS = 3000; // retry after 3s if ineligible

// ---------- Map generation ----------
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

// ---- WSS ----
const PORT = 8081;
const wss = new WebSocketServer({ port: PORT });
console.log(
  `WebSocket server starting on ws://localhost:${PORT} (logging enabled)`
);

// ---- Multi-lobby state ----
const lobbies = new Map(); // lobbyId -> lobbyState
const lobbyOfWs = new Map(); // ws -> lobbyState

function createLobby(lobbyId) {
  return {
    id: lobbyId,
    gameInProgress: false,

    // players
    players: new Map(), // ws -> { id, name, character, joinedAt }
    idToWs: new Map(), // id -> ws
    nextId: 1,

    // game state
    currentMap: null,
    countdown: null, // { until }
    countdownTimer: null,

    // player state
    playerPositions: new Map(), // id -> { r, c, dir }
    playerLives: new Map(), // id -> lives
    playerStatus: new Map(), // id -> "alive" | "dead"
    lastHitTime: new Map(), // id -> last damage ts

    // powerups
    playerPowerups: new Map(), // id -> { bomb, flame, speed, life }

    // block respawn
    respawnQueue: [], // [{ r, c, dueAt, tries }]
  };
}

function getLobby(lobbyId = "default") {
  let lobby = lobbies.get(lobbyId);
  if (!lobby) {
    lobby = createLobby(lobbyId);
    lobbies.set(lobbyId, lobby);
  }
  return lobby;
}

// 🔁 Find or create a lobby with space and not in progress
function findOrCreateLobbyWithSpace(baseId) {
  // Try base lobby first
  let base = lobbies.get(baseId);
  if (base && !base.gameInProgress && base.players.size < MAX_PLAYERS_PER_LOBBY) {
    return base;
  }

  // Then try numbered lobbies: baseId-2, baseId-3, ...
  let idx = 2;
  while (true) {
    const candidateId = `${baseId}-${idx}`;
    let candidate = lobbies.get(candidateId);

    if (!candidate) {
      candidate = createLobby(candidateId);
      lobbies.set(candidateId, candidate);
      log(`Created new lobby ${candidateId} (based on ${baseId})`);
      return candidate;
    }

    if (!candidate.gameInProgress && candidate.players.size < MAX_PLAYERS_PER_LOBBY) {
      return candidate;
    }

    idx++;
  }
}

// ---- Utils ----
function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

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

function isPlayerAt(lobby, r, c) {
  for (const pos of lobby.playerPositions.values()) {
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

function wouldHardTrapPlayer(lobby, r, c) {
  for (const [, pos] of lobby.playerPositions.entries()) {
    const dist = Math.abs(pos.r - r) + Math.abs(pos.c - c);
    if (dist === 1) {
      let open = 0;
      for (const nb of neighbors4(pos.r, pos.c)) {
        if (nb.r === r && nb.c === c) continue;
        const cell = lobby.currentMap?.[nb.r]?.[nb.c];
        if (isWalkableCell(cell)) open++;
      }
      if (open === 0) return true;
    }
  }
  return false;
}

function isEligibleRespawnCell(lobby, r, c) {
  if (!lobby.currentMap) return false;
  if (r <= 0 || c <= 0 || r >= GRID_ROWS - 1 || c >= GRID_COLS - 1)
    return false;

  const cell = lobby.currentMap[r]?.[c];
  if (!cell) return false;
  if (!(cell.type === "empty" || cell.type === "telegraph")) return false;
  if (isPlayerAt(lobby, r, c)) return false;
  if (isInSpawnSafeZone(r, c)) return false;
  if (wouldHardTrapPlayer(lobby, r, c)) return false;

  return true;
}

function scheduleBlockRespawn(
  lobby,
  r,
  c,
  delayMs = randInt(RESPAWN_MIN_MS, RESPAWN_MAX_MS)
) {
  lobby.respawnQueue.push({ r, c, dueAt: Date.now() + delayMs, tries: 0 });
}

// ---- Player Position Management ----
function initializePlayerPositions(lobby, playersList, gameMap) {
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
    lobby.playerPositions.set(player.id, {
      r: seed.r,
      c: seed.c,
      dir: "down",
    });
  });
}

function broadcastAllPlayerPositions(lobby) {
  const allPositions = {};
  lobby.playerPositions.forEach((pos, id) => {
    const ws = lobby.idToWs.get(id);
    const player = ws ? lobby.players.get(ws) : null;
    if (player) {
      allPositions[player.name] = pos;
    }
  });

  broadcastToLobby(lobby, {
    type: "all-positions",
    payload: { positions: allPositions },
  });
}

// ---- Explosion Logic ----
function calculateExplosionPattern(centerR, centerC, range, gameMap) {
  const cells = [{ r: centerR, c: centerC }];

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

      if (r < 0 || r >= gameMap.length || c < 0 || c >= gameMap[0].length)
        break;

      const cell = gameMap[r]?.[c];

      if (cell?.type === "wall" || cell?.type === "border") break;

      cells.push({ r, c });

      if (cell?.type === "block") break;
    }
  });

  return cells;
}

function destroyBlocksInExplosion(lobby, explosionCells) {
  if (!lobby.currentMap) return;

  let destroyedBlocks = 0;

  explosionCells.forEach(({ r, c }) => {
    if (lobby.currentMap[r]?.[c]?.type === "block") {
      const block = lobby.currentMap[r][c];

      if (block.hasPowerup && block.powerupType) {
        lobby.currentMap[r][c] = {
          type: "powerup",
          row: r,
          col: c,
          powerupType: block.powerupType,
          destroyable: false,
          walkable: true,
        };
      } else {
        lobby.currentMap[r][c] = {
          type: "empty",
          row: r,
          col: c,
          walkable: true,
        };
      }

      scheduleBlockRespawn(lobby, r, c);
      destroyedBlocks++;
    }
  });

  if (destroyedBlocks > 0) {
    broadcastToLobby(lobby, {
      type: "map-update",
      payload: { map: lobby.currentMap },
    });
  }
}

// ---- Game over ----
function checkGameOver(lobby) {
  if (!lobby.gameInProgress) return;

  const alivePlayers = Array.from(lobby.playerStatus.entries())
    .filter(([, status]) => status != "dead")
    .map(([id]) => id);

  log(
    `Lobby[${lobby.id}] Checking game over: ${alivePlayers.length} players alive`
  );
  if (alivePlayers.length === 0) {
    log(
      `Lobby[${lobby.id}] ⚰️ All players dead or gone — game over (no winner)`
    );
    endGame(lobby, null);
    return;
  }

  if (alivePlayers.length === 1) {
    const winnerId = alivePlayers[0];
    const winner = Array.from(lobby.players.values()).find(
      (p) => p.id === winnerId
    );
    if (winner) {
      log(`Lobby[${lobby.id}] 🏆 Game Over — Winner: ${winner.name}`);
      endGame(lobby, winner);
    } else {
      log(
        `Lobby[${lobby.id}] 🏁 Last player disconnected before win detected`
      );
      endGame(lobby, null);
    }
  }
}

function endGame(lobby, winner) {
  if (!lobby.gameInProgress) return;
  lobby.gameInProgress = false;

  const payload = {
    winner: winner
      ? { id: winner.id, name: winner.name, character: winner.character }
      : null,
    reason: winner ? "win" : "all-dead",
  };

  broadcastToLobby(lobby, { type: "game-over", payload });

  log(
    `Lobby[${lobby.id}] 🎮 Game over broadcasted — ${
      winner ? `Winner: ${winner.name}` : "No survivors"
    }`
  );

  lobby.playerPositions.clear();
  lobby.playerLives.clear();
  lobby.playerStatus.clear();
  lobby.currentMap = null;
  lobby.countdown = null;
  clearCountdown(lobby);

  setTimeout(() => {
    broadcastLobby(lobby);
  }, 3000);
}

// ---- Send / broadcast helpers ----
function sendTo(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

// Broadcast to everyone in one lobby
function broadcastToLobby(lobby, obj) {
  const raw = JSON.stringify(obj);
  lobby.players.forEach((_player, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(raw);
    }
  });
}

// Global broadcast (for debug if needed)
function broadcast(obj) {
  const raw = JSON.stringify(obj);
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) c.send(raw);
  });
}

function snapshotPlayers(lobby) {
  return Array.from(lobby.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    character: p.character,
    lives: lobby.playerLives.get(p.id) ?? 3,
  }));
}

function broadcastLobby(lobby) {
  const payload = {
    players: snapshotPlayers(lobby),
    countdownUntil: lobby.countdown ? lobby.countdown.until : null,
  };
  broadcastToLobby(lobby, { type: "lobby", payload });
  log(
    `Lobby[${lobby.id}] update → ${payload.players.length} player(s). countdown=${
      payload.countdownUntil || "none"
    }`
  );
}

// ---- Countdown ----
function startCountdown(lobby, ms) {
  clearCountdown(lobby);
  const until = Date.now() + ms;
  lobby.countdown = { until };
  log(
    `Lobby[${lobby.id}] Starting countdown: ${ms / 1000}s (until=${new Date(
      until
    ).toISOString()})`
  );
  broadcastLobby(lobby);

  lobby.countdownTimer = setTimeout(() => {
    lobby.countdownTimer = null;
    lobby.countdown = null;
    startGame(lobby);
  }, ms);
}

function clearCountdown(lobby) {
  if (lobby.countdownTimer) {
    clearTimeout(lobby.countdownTimer);
    lobby.countdownTimer = null;
  }
  lobby.countdown = null;
}

function evaluateCountdownRules(lobby) {
  const count = lobby.players.size;

  if (count < 2) {
    if (lobby.countdown) {
      log(`Lobby[${lobby.id}] Not enough players (<2). Canceling countdown.`);
      clearCountdown(lobby);
      broadcastLobby(lobby);
    }
    return;
  }

  if (lobby.countdown) {
    if (count === 4) {
      const remaining = lobby.countdown.until - Date.now();
      if (remaining > 10000) {
        log(`Lobby[${lobby.id}] 4 players reached — shorten countdown to 10s`);
        clearCountdown(lobby);
        startCountdown(lobby, 10000);
      }
    }
    return;
  }

  if (!lobby.countdown && count >= 2) {
    log(`Lobby[${lobby.id}] At least 2 players - starting 30s countdown`);
    startCountdown(lobby, 5000);
  }
}

// ---- Powerups ----
function collectPowerup(lobby, playerId, powerupType, r, c) {
  if (!lobby.playerPowerups.has(playerId)) {
    lobby.playerPowerups.set(playerId, {
      bomb: 0,
      flame: 0,
      speed: 0,
      life: 0,
    });
  }

  const playerPowers = lobby.playerPowerups.get(playerId);
  playerPowers[powerupType] = (playerPowers[powerupType] || 0) + 1;

  if (lobby.currentMap && lobby.currentMap[r]?.[c]?.type === "powerup") {
    lobby.currentMap[r][c] = {
      type: "empty",
      row: r,
      col: c,
      walkable: true,
    };
    let expiresAt = Date.now() + 10000;

    const existingCount = playerPowers[powerupType] - 1;
    if (powerupType === "speed" && existingCount > 0) {
      expiresAt = Date.now() + 10000;
    }

    broadcastToLobby(lobby, {
      type: "map-update",
      payload: { map: lobby.currentMap },
    });

    const playerName = (() => {
      const ws = lobby.idToWs.get(playerId);
      const p = ws ? lobby.players.get(ws) : null;
      return p?.name;
    })();

    broadcastToLobby(lobby, {
      type: "powerup-collected",
      payload: {
        playerId,
        playerName,
        powerupType,
        r,
        c,
        newCount: playerPowers[powerupType],
      },
    });

    scheduleBlockRespawn(lobby, r, c);

    if (powerupType === "life") {
      const cur = lobby.playerLives.get(playerId) ?? 3;
      if (cur < 3) {
        const next = Math.min(3, cur + 1);
        lobby.playerLives.set(playerId, next);
        broadcastToLobby(lobby, {
          type: "lives-update",
          payload: { id: playerId, lives: next, reason: "life-powerup" },
        });
      }
    }
  }
}

// ---- Game lifecycle ----
function startGame(lobby) {
  lobby.gameInProgress = true;
  const list = snapshotPlayers(lobby).slice(0, 4);
  lobby.currentMap = generateMap();
  list.forEach((p) => lobby.playerLives.set(p.id, 3));

  broadcastToLobby(lobby, {
    type: "lives-bulk",
    payload: list.map((p) => ({ id: p.id, lives: 3 })),
  });

  initializePlayerPositions(lobby, list, lobby.currentMap);

  const payload = {
    players: list,
    gameId: `game-${lobby.id}-${Date.now()}`,
    map: lobby.currentMap,
  };

  log(
    `Lobby[${lobby.id}] Starting game with players: ${list
      .map((p) => p.name)
      .join(", ")}`
  );
  broadcastToLobby(lobby, { type: "start", payload });

  broadcastAllPlayerPositions(lobby);
  clearCountdown(lobby);
  broadcastLobby(lobby);
}

function sendState(lobby, ws) {
  const payload = {
    players: snapshotPlayers(lobby).slice(0, 4),
    map: lobby.currentMap,
  };
  sendTo(ws, { type: "state", payload });
}

// ---- Chat ----
function broadcastChat(lobby, from, text) {
  const payload = { from, text, ts: Date.now() };
  broadcastToLobby(lobby, { type: "chat", payload });
}

// ---- Connection handling ----
wss.on("connection", (ws, req) => {
  ws._created = Date.now();
  // log("Client connected");
 let roomId = "default";
  try {
    const url = new URL(req.url || "/", "http://localhost");
    roomId = url.searchParams.get("roomId") || "default";
  } catch {
    roomId = "default";
  }
  ws._roomId = roomId;

  log(`Client connected (roomId=${roomId})`);
  // At first we don't know the lobby; send empty lobby snapshot
  sendTo(ws, {
    type: "lobby",
    payload: {
      players: [],
      countdownUntil: null,
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
  // Base lobby = roomId from URL; fallback to payload.lobbyId; then "default"
  const baseLobbyId = ws._roomId || payload?.lobbyId || "default";
  let lobby = getLobby(baseLobbyId);

  // If lobby is marked in-progress but empty, reset it
  if (lobby.players.size === 0 && lobby.gameInProgress) {
    log(
      `Lobby[${lobby.id}] All players disconnected previously. Ending game flag.`
    );
    lobby.gameInProgress = false;
  }

  // If this lobby is busy (in progress or full), redirect to another lobby
  if (lobby.gameInProgress || lobby.players.size >= MAX_PLAYERS_PER_LOBBY) {
    log(
      `Lobby[${lobby.id}] busy (inProgress=${lobby.gameInProgress}, players=${lobby.players.size}). ` +
        `Finding/creating another lobby for ${payload?.name || "unknown"}...`
    );
    lobby = findOrCreateLobbyWithSpace(baseLobbyId);
  }

  let requested = payload?.name
    ? String(payload.name).slice(0, 32).trim()
    : "";
  if (!requested) requested = `p${lobby.nextId}`;
  const character = payload?.character || "mario";

  const taken = Array.from(lobby.players.values()).some(
    (p) => p.name.toLowerCase() === requested.toLowerCase()
  );
  if (taken) {
    sendTo(ws, { type: "error", message: "Nickname already taken" });
    return;
  }

  if (requested.length < 3 || requested.length > 8) {
    sendTo(ws, {
      type: "error",
      message: "Nickname has to be between 3-8 characters",
    });
    return;
  }

  if (requested.includes(" ")) {
    sendTo(ws, {
      type: "error",
      message: "Nickname cannot contain spaces",
    });
    return;
  }

  const id = lobby.nextId++;
  ws._id = id;
  ws._lobbyId = lobby.id;

  lobby.players.set(ws, {
    id,
    name: requested,
    character,
    joinedAt: Date.now(),
  });
  lobby.idToWs.set(id, ws);
  lobby.playerLives.set(id, 3);
  lobby.playerStatus.set(id, "alive");
  lobbyOfWs.set(ws, lobby);

  broadcastToLobby(lobby, {
    type: "lives-update",
    payload: { id, lives: 3, reason: "join" },
  });

  log(
    `Player join: ${requested} as ${character} (id=${id}) in lobby=${lobby.id}, total=${lobby.players.size}`
  );
  broadcastLobby(lobby);
  evaluateCountdownRules(lobby);
  return;
}


    // All other messages need a lobby
    const lobby = lobbyOfWs.get(ws);
    if (!lobby) {
      log("Message from client without lobby:", type);
      return;
    }

    if (type === "move") {
      const from = lobby.players.get(ws);
      if (!from) return;
      const { r, c, dir } = payload;

      lobby.playerPositions.set(from.id, { r, c, dir });

      broadcastToLobby(lobby, {
        type: "player-move",
        payload: {
          id: from.id,
          name: from.name,
          r,
          c,
          dir,
        },
      });

      if (lobby.currentMap && lobby.currentMap[r]?.[c]?.type === "powerup") {
        const powerupType = lobby.currentMap[r][c].powerupType;
        if (powerupType) {
          collectPowerup(lobby, from.id, powerupType, r, c);
        }
      }
      return;
    }

    if (type === "request-positions") {
      broadcastAllPlayerPositions(lobby);
      return;
    }

    if (type === "chat") {
      const entry = lobby.players.get(ws);
      const from = entry ? entry.name : "anon";
      const text = String(payload?.text ?? "").slice(0, 300);
      log(`Lobby[${lobby.id}] Chat from ${from}: ${text}`);
      broadcastChat(lobby, from, text);
      return;
    }

    if (type === "place-bomb") {
      const from = lobby.players.get(ws);
      if (!from) return;
      const status = lobby.playerStatus.get(from.id);
      if (status === "dead") return;

      const { r, c } = payload;

      broadcastToLobby(lobby, {
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

    if (type === "bomb-explode") {
      const from = lobby.players.get(ws);
      if (!from) return;
      const status = lobby.playerStatus.get(from.id);
      if (status === "dead") return;

      const { r, c, range = 1 } = payload;
      if (typeof r !== "number" || typeof c !== "number") return;
      if (!lobby.currentMap) return;

      console.log(
        `Lobby[${lobby.id}] 💥 SERVER received bomb explosion from ${from.name} at (${r}, ${c}) with range ${range}`
      );

      const explosionCells = calculateExplosionPattern(
        r,
        c,
        range,
        lobby.currentMap
      );

      destroyBlocksInExplosion(lobby, explosionCells);

      broadcastToLobby(lobby, {
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

    if (type === "game-state") {
      sendState(lobby, ws);
      return;
    }

    if (type === "request-map") {
      if (!lobby.currentMap) {
        lobby.currentMap = generateMap();
      }
      sendTo(ws, { type: "map", payload: { map: lobby.currentMap } });
      return;
    }

    if (type === "request-players") {
      sendTo(ws, {
        type: "players",
        payload: { players: snapshotPlayers(lobby).slice(0, 4) },
      });
      return;
    }

    if (type === "map-update") {
      const m = payload?.map;
      if (Array.isArray(m) && m.length) {
        lobby.currentMap = m;
        broadcastToLobby(lobby, {
          type: "map-update",
          payload: { map: lobby.currentMap },
        });
      }
      return;
    }

    if (type === "request-lives") {
      const pack = Array.from(lobby.players.values()).map((p) => ({
        id: p.id,
        lives: lobby.playerLives.get(p.id) ?? 3,
      }));
      sendTo(ws, { type: "lives-bulk", payload: pack });
      return;
    }

    if (type === "lose-life") {
      const from = lobby.players.get(ws);
      if (!from) return;
      const status = lobby.playerStatus.get(from.id);
      if (status === "dead") return;

      const now = Date.now();
      const last = lobby.lastHitTime.get(from.id) || 0;

      if (now - last < HIT_COOLDOWN) {
        console.log(
          `Lobby[${lobby.id}] Ignored rapid hit from ${from.name} (${
            now - last
          }ms since last)`
        );
        return;
      }
      lobby.lastHitTime.set(from.id, now);

      const cur = lobby.playerLives.get(from.id) ?? 3;
      const next = Math.max(0, cur - 1);
      if (next === cur) return;

      lobby.playerLives.set(from.id, next);
      console.log(
        `Lobby[${lobby.id}] ❤️ ${from.name} lost a life -> ${next} (reason: ${
          payload?.reason || "unknown"
        })`
      );

      broadcastToLobby(lobby, {
        type: "lives-update",
        payload: { id: from.id, lives: next, reason: payload?.reason || "hit" },
      });

      if (next <= 0) {
        lobby.playerStatus.set(from.id, "dead");
        broadcastToLobby(lobby, {
          type: "player-dead",
          payload: { id: from.id, name: from.name },
        });

        broadcastToLobby(lobby, {
          type: "spectate-mode",
          payload: { id: from.id, name: from.name },
        });

        log(`Lobby[${lobby.id}] 💀 ${from.name} is now spectating`);
      }
      checkGameOver(lobby);
      return;
    }

    // WebRTC signaling
    if (type === "rtc-offer") {
      const toId = payload?.toId;
      const fromId = lobby.players.get(ws)?.id;
      const sdp = payload?.sdp;
      const target = lobby.idToWs.get(toId);
      if (target && target.readyState === WebSocket.OPEN) {
        target.send(
          JSON.stringify({ type: "rtc-offer", payload: { fromId, sdp } })
        );
      }
      return;
    }

    if (type === "rtc-answer") {
      const toId = payload?.toId;
      const fromId = lobby.players.get(ws)?.id;
      const sdp = payload?.sdp;
      const target = lobby.idToWs.get(toId);
      if (target && target.readyState === WebSocket.OPEN) {
        target.send(
          JSON.stringify({ type: "rtc-answer", payload: { fromId, sdp } })
        );
      }
      return;
    }

    if (type === "rtc-ice") {
      const toId = payload?.toId;
      const fromId = lobby.players.get(ws)?.id;
      const candidate = payload?.candidate;
      const target = lobby.idToWs.get(toId);
      if (target && target.readyState === WebSocket.OPEN) {
        target.send(
          JSON.stringify({ type: "rtc-ice", payload: { fromId, candidate } })
        );
      }
      return;
    }

    if (type === "collect-powerup") {
      const from = lobby.players.get(ws);
      if (!from) return;

      const { r, c, powerupType } = payload;
      if (
        lobby.currentMap &&
        lobby.currentMap[r]?.[c]?.type === "powerup" &&
        lobby.currentMap[r][c].powerupType === powerupType
      ) {
        collectPowerup(lobby, from.id, powerupType, r, c);
      }
      return;
    }

    log("Unknown msg type:", type);
  });

  ws.on("close", () => {
    const lobby = lobbyOfWs.get(ws);
    if (!lobby) {
      log("An unregistered client disconnected");
      return;
    }

    const p = lobby.players.get(ws);
    if (p) {
      lobby.playerStatus.set(p.id, "dead");
      lobby.playerPositions.delete(p.id);
      lobby.idToWs.delete(p.id);
      lobby.players.delete(ws);
      lobbyOfWs.delete(ws);

      log(
        `Player disconnected: ${p.name} (id=${p.id}) from lobby=${lobby.id}, total=${lobby.players.size}`
      );

      broadcastLobby(lobby);
      evaluateCountdownRules(lobby);
      if (lobby.gameInProgress) checkGameOver(lobby);
    } else {
      log("A client without player info disconnected");
    }
  });

  ws.on("error", (err) => {
    log("WS error:", err?.message);
  });
});

// --- Respawn scheduler ---
setInterval(() => {
  lobbies.forEach((lobby) => {
    if (!lobby.currentMap || lobby.respawnQueue.length === 0) return;

    const now = Date.now();
    const pending = lobby.respawnQueue.splice(0, lobby.respawnQueue.length);

    for (const job of pending) {
      if (job.dueAt > now) {
        lobby.respawnQueue.push(job);
        continue;
      }

      const { r, c } = job;

      if (!isEligibleRespawnCell(lobby, r, c)) {
        if (job.tries < 5) {
          job.tries++;
          job.dueAt = now + RESPAWN_BACKOFF_MS;
          lobby.respawnQueue.push(job);
        }
        continue;
      }

      lobby.currentMap[r][c] = {
        type: "telegraph",
        row: r,
        col: c,
        walkable: true,
      };
      broadcastToLobby(lobby, {
        type: "map-update",
        payload: { map: lobby.currentMap },
      });

      setTimeout(() => {
        if (!isEligibleRespawnCell(lobby, r, c)) return;

        const hasPowerup = Math.random() < RESPAWN_POWERC_UP_CHANCE;
        const powerupTypes = ["bomb", "flame", "speed", "life"];
        const powerupType = hasPowerup
          ? powerupTypes[Math.floor(Math.random() * powerupTypes.length)]
          : null;

        lobby.currentMap[r][c] = {
          type: "block",
          row: r,
          col: c,
          destroyable: true,
          hasPowerup,
          powerupType,
        };

        broadcastToLobby(lobby, {
          type: "map-update",
          payload: { map: lobby.currentMap },
        });
      }, TELEGRAPH_MS);
    }
  });
}, RESPAWN_TICK_MS);

log("Server listening on port", PORT);
