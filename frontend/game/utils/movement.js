// src/utils/movement.js
export const SOLID = new Set(["empty", "powerup"]);

export function isWalkable(gameMap, r, c) {
  if (!Array.isArray(gameMap) || !Array.isArray(gameMap[0])) return false;
  if (r < 0 || c < 0 || r >= gameMap.length || c >= gameMap[0].length) return false;
  const t = gameMap[r][c]?.type;
  return SOLID.has(t);
}

export function dirToDelta(dir) {
  switch (dir) {
    case "up": return { dr: -1, dc: 0 };
    case "down": return { dr: 1, dc: 0 };
    case "left": return { dr: 0, dc: -1 };
    case "right": return { dr: 0, dc: 1 };
    default: return { dr: 0, dc: 0 };
  }
}
