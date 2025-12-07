//not used
import { h } from "../../framework/dom.js";
import { useEffect, useState, useRef } from "../../framework/hooks.js";
import { GRID_COLS, GRID_ROWS, CELL_SIZE } from "../Methods/mapGenerator.js";
import { getSocket } from "../services/ws.js";

/* ---------------------- Sprites ---------------------- */
const SPRITES = {
  Mario: {
    down: "/assets/Characters/Movement/Mario_down.png",
    up: "/assets/Characters/Movement/Mario_up.png",
    left: "/assets/Characters/Movement/Mario_left.png",
    right: "/assets/Characters/Movement/Mario_right.png",
  },
  Peach: {
    down: "/assets/Characters/Movement/Peach_down.png",
    up: "/assets/Characters/Movement/Peach_up.png",
    left: "/assets/Characters/Movement/Peach_left.png",
    right: "/assets/Characters/Movement/Peach_right.png",
  },
  Yoshi: {
    down: "/assets/Characters/Movement/Yoshi_down.png",
    up:   "/assets/Characters/Movement/Yoshi_up.png",
    left: "/assets/Characters/Movement/Yoshi_left.png",
    right:"/assets/Characters/Movement/Yoshi_right.png",
  },
  Toadette: {
    down: "/assets/Characters/Movement/Toadette_down.png",
    up:   "/assets/Characters/Movement/Toadette_up.png",
    left: "/assets/Characters/Movement/Toadette_left.png",
    right:"/assets/Characters/Movement/Toadette_right.png",
  },
};

function detectCharacterName(player) {
  const raw = String(player?.character || player?.name || "").toLowerCase();
  if (raw.includes("mario")) return "Mario";
  if (raw.includes("peach")) return "Peach";
  if (raw.includes("yoshi")) return "Yoshi";
  if (raw.includes("toad")) return "Toadette";
  return "Mario";
}

/* ---------------------- Grid helpers ---------------------- */
function isWalkable(cell) {
  if (!cell) return false;
  const t = cell.type;
  return t === "empty" || t === "powerup";;
}
function seedsFor(gameMap) {
  const R = gameMap.length, C = gameMap[0].length;
  return [
    { r: 1, c: 1 },
    { r: 1, c: C - 2 },
    { r: R - 2, c: 1 },
    { r: R - 2, c: C - 2 },
  ];
}
function nearestWalkable(gameMap, r0, c0, maxRadius = 8) {
  const R = gameMap.length, C = gameMap[0].length;
  const ok = (r,c)=>r>=0&&r<R&&c>=0&&c<C&&isWalkable(gameMap[r][c]);
  if (ok(r0,c0)) return { r:r0, c:c0 };
  for (let d=1; d<=maxRadius; d++) {
    for (let dr=-d; dr<=d; dr++) {
      const dc = d - Math.abs(dr);
      const cand = [
        { r: r0 + dr, c: c0 + dc },
        { r: r0 + dr, c: c0 - dc },
      ];
      for (const p of cand) if (ok(p.r, p.c)) return p;
    }
  }
  return null;
}

/** Deterministic spawn assignment for ALL players (including self). */
function computeSpawns(gameMap, players) {
  const seeds = seedsFor(gameMap);
  const used = new Set();
  const map = new Map(); // key: playerKey -> {r,c}

  players.forEach((p, idx) => {
    const seed = seeds[idx % seeds.length];
    const pos = nearestWalkable(gameMap, seed.r, seed.c, 6);
    if (!pos) return;

    // avoid duplicate cell
    let { r, c } = pos;
    let k = `${r}:${c}`;
    if (used.has(k)) {
      // simple spiral-ish probe
      const tryOffsets = [
        [0,1],[1,0],[0,-1],[-1,0],
        [1,1],[1,-1],[-1,1],[-1,-1],
        [0,2],[2,0],[0,-2],[-2,0]
      ];
      for (const [dr,dc] of tryOffsets) {
        const rr = r+dr, cc = c+dc;
        if (rr<0||rr>=gameMap.length||cc<0||cc>=gameMap[0].length) continue;
        if (!isWalkable(gameMap[rr][cc])) continue;
        const kk = `${rr}:${cc}`;
        if (!used.has(kk)) { r=rr; c=cc; k=kk; break; }
      }
    }
    used.add(k);
    map.set(p?.id ?? p?.name ?? idx, { r, c });
  });

  return map;
}

export default function PlayersLayer({ gameMap, players, self }) {
  if (!Array.isArray(gameMap) || gameMap.length === 0) return null;
  if (!Array.isArray(players) || players.length === 0) return null;
  if (!self) return null;

  // Build spawn map whenever roster/map changes
  const spawnsRef = useRef(new Map());
  useEffect(() => {
    spawnsRef.current = computeSpawns(gameMap, players);
  }, [gameMap, players]);

  // initial self spawn
  const selfKey = self?.id ?? self?.name;
  const selfSpawn = spawnsRef.current.get(selfKey) || { r: 1, c: 1 };

  const [pos, setPos] = useState({ r: selfSpawn.r, c: selfSpawn.c });
  const [dir, setDir] = useState("down");
  const posRef = useRef(pos);
  posRef.current = pos;

  // if spawns recomputed (e.g., player joined), keep self on current cell
  useEffect(() => {
    if (!spawnsRef.current.has(selfKey)) return;
    // only set if we never moved (fresh mount)
    if (posRef.current == null) {
      const s = spawnsRef.current.get(selfKey);
      setPos({ r: s.r, c: s.c });
    }
  }, [spawnsRef.current, selfKey]);

  const ws = getSocket();

  /* ---------- movement for self ---------- */
  useEffect(() => {
    const held = new Set();
    let timer = null;

    const step = () => {
      let { r, c } = posRef.current;
      const keys = Array.from(held);
      if (!keys.length) return;

      let newDir = dir;
      const key = keys[keys.length - 1];

      if (key === "arrowup" || key === "w") {
        newDir = "up";
        if (r > 0 && isWalkable(gameMap[r - 1][c])) r -= 1;
      } else if (key === "arrowdown" || key === "s") {
        newDir = "down";
        if (r < GRID_ROWS - 1 && isWalkable(gameMap[r + 1][c])) r += 1;
      } else if (key === "arrowleft" || key === "a") {
        newDir = "left";
        if (c > 0 && isWalkable(gameMap[r][c - 1])) c -= 1;
      } else if (key === "arrowright" || key === "d") {
        newDir = "right";
        if (c < GRID_COLS - 1 && isWalkable(gameMap[r][c + 1])) c += 1;
      }

      if (r !== posRef.current.r || c !== posRef.current.c || newDir !== dir) {
        const next = { r, c };
        posRef.current = next;
        setPos(next);
        setDir(newDir);

        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "move",
            payload: { id: self.id, name: self.name, r, c, dir: newDir },
          }));
        }
      }
    };

    const onDown = (e) => {
      const k = (e.key || "").toLowerCase();
      if (!["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d"].includes(k)) return;
      e.preventDefault();
      held.add(k);
      if (!timer) {
        step();
        timer = setInterval(step, 120);
      }
    };
    const onUp = (e) => {
      const k = (e.key || "").toLowerCase();
      if (held.has(k)) held.delete(k);
      if (!held.size && timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      if (timer) clearInterval(timer);
    };
  }, [gameMap, ws, players.length, self?.id, dir]);

  /* ---------- render ---------- */
  const nodes = [];

  // render others at their spawn (static)
  players.forEach((p, idx) => {
    const isSelf =
      (self?.id != null && p?.id != null && String(self.id) === String(p.id)) ||
      ((p?.id == null || self?.id == null) &&
        (p?.name || "").trim().toLowerCase() === (self?.name || "").trim().toLowerCase());

    if (isSelf) return; // we'll render "you" below

    const key = p?.id ?? p?.name ?? idx;
    const spawn = spawnsRef.current.get(key);
    if (!spawn) return;

    const charName = detectCharacterName(p);
    const img = (SPRITES[charName] || SPRITES.Mario).down;

    nodes.push(
      h(
        "div",
        {
          key: `other-${key}`,
          class: "absolute select-none z-10",
          style: `
            top:${spawn.r * CELL_SIZE}px;
            left:${spawn.c * CELL_SIZE}px;
            width:${CELL_SIZE}px;
            height:${CELL_SIZE}px;
            image-rendering: pixelated;
          `,
        },
        h("img", {
          src: img,
          alt: charName,
          draggable: false,
          class: "-translate-y-10",
          style: `
            width:100%;
            height:auto;
            object-fit: contain;
            pointer-events:none;
          `,
        })
      )
    );
  });

  // render self (movable)
  const charName = detectCharacterName(self);
  const sheet = SPRITES[charName] || SPRITES.Mario;
  nodes.push(
    h(
      "div",
      {
        key: "self",
        class: "absolute select-none z-20 transition-all duration-100 ease-linear",
        style: `
          top:${pos.r * CELL_SIZE}px;
          left:${pos.c * CELL_SIZE}px;
          width:${CELL_SIZE}px;
          height:${CELL_SIZE}px;
          image-rendering: pixelated;
        `,
      },
      h("img", {
        src: sheet[dir] || sheet.down,
        alt: `${charName}-${dir}`,
        draggable: false,
        style: `
          width:100%;
          height:100%;
          object-fit: contain;
          pointer-events:none;
        `,
      })
    )
  );

  return h("div", null, nodes);
}
