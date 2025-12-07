import { h } from "../../framework/dom.js";
import { useEffect } from "../../framework/hooks.js";
import { CELL_SIZE } from "../Methods/mapGenerator.js";
import { getSocket } from "../services/ws.js";

const SPRITE_BY_NAME = {
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
    up: "/assets/Characters/Movement/Yoshi_up.png",
    left: "/assets/Characters/Movement/Yoshi_left.png",
    right: "/assets/Characters/Movement/Yoshi_right.png",
  },
  Toadette: {
    down: "/assets/Characters/Movement/Toadette_down.png",
    up: "/assets/Characters/Movement/Toadette_up.png",
    left: "/assets/Characters/Movement/Toadette_left.png",
    right: "/assets/Characters/Movement/Toadette_right.png",
  },
};

function isWalkable(cell) {
  if (!cell) return false;
  const t = cell.type;
  return t === "empty" || t === "powerup";;
}

function findNearestWalkable(gameMap, r0, c0, maxRadius = 8) {
  const R = gameMap.length, C = gameMap[0].length;
  const ok = (r, c) =>
    r >= 0 && r < R && c >= 0 && c < C && isWalkable(gameMap[r][c]);
  if (ok(r0, c0)) return { r: r0, c: c0 };
  for (let d = 1; d <= maxRadius; d++) {
    for (let dr = -d; dr <= d; dr++) {
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

function detectCharacterName(player) {
  const raw = String(player?.character || player?.name || "").toLowerCase();
  if (raw.includes("mario")) return "Mario";
  if (raw.includes("peach") || raw.includes("prince")) return "Peach";
  if (raw.includes("yoshi") || raw.includes("dragon")) return "Yoshi";
  if (raw.includes("toad") || raw.includes("mash")) return "Toadette";
  return "Mario";
}

function normalizeName(name) {
   let cleaned = String(name || "").trim();
  // Remove surrounding quotes if they exist
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.toLowerCase();
}

export default function PlayerSprites({ gameMap, players, selfName, playerPositions }) {
  const normalizedSelfName = normalizeName(selfName);

  if (!Array.isArray(gameMap) || gameMap.length === 0) return null;
  if (!Array.isArray(players) || players.length === 0) return null;

  const otherPlayers = players.filter(player => {
    const playerName = normalizeName(player.name);
    const isSelf = playerName === normalizedSelfName;
    return !isSelf;
  });
  
  if (otherPlayers.length === 0) {
    return null;
  }

  const nodes = otherPlayers
  .filter(p => !p.dead)
  .map((player, idx) => {
    const charName = detectCharacterName(player);
    const sheet = SPRITE_BY_NAME[charName] || SPRITE_BY_NAME.Mario;
    
    const position = playerPositions[player.name] || { r: 1, c: 1, dir: "down" };

    const top = position.r * CELL_SIZE;
    const left = position.c * CELL_SIZE;

    return h(
      "div",
      {
        key: `other-player-${player.name}-${idx}`,
        class: "absolute select-none z-10 transition-all duration-100 ease-linear",
        style: `
          top:${top}px;
          left:${left}px;
          width:${CELL_SIZE}px;
          height:${CELL_SIZE}px;
          image-rendering: pixelated;
        `,
      },
      h("img", {
        src: sheet[position.dir] || sheet.down,
        alt: `${charName}-other`,
        draggable: false,
        class: "-translate-y-3",
       style: `
        width:100%;
        height:100%;
        object-fit: contain;
        pointer-events:none;
      `,
      })
    );
  });

  return h("div", null, nodes);
}