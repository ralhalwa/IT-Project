export const GRID_COLS = 13;
export const GRID_ROWS = 11;
export const WALL_COLS = 6;
export const WALL_ROWS = 5;
export const CELL_SIZE = 62;

export function generateMap() {
  const map = [];

  // Initialize map with border cells
  for (let row = 0; row < GRID_ROWS; row++) {
    map[row] = [];
    for (let col = 0; col < GRID_COLS; col++) {
      // Create border cells around the edges
      if (row === 0 || row === GRID_ROWS - 1 || col === 0 || col === GRID_COLS - 1) {
        map[row][col] = { type: 'border', row, col };
      } else {
        map[row][col] = { type: 'empty', row, col };
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
        map[y][x] = { type: 'wall', row: y, col: x };
      }
    }
  }

  // Safe zones around players start position
  const safeZones = [
    { x: 1, y: 1 },
    { x: GRID_COLS - 2, y: 1 },
    { x: 1, y: GRID_ROWS - 2 },
    { x: GRID_COLS - 2, y: GRID_ROWS - 2 }
  ];

  // Surrounding cells to safe zones
  const extendedSafeZones = [];
  safeZones.forEach(zone => {
    extendedSafeZones.push(zone);
    extendedSafeZones.push({ x: zone.x, y: zone.y + 1 });
    extendedSafeZones.push({ x: zone.x + 1, y: zone.y });
    extendedSafeZones.push({ x: zone.x - 1, y: zone.y });
    extendedSafeZones.push({ x: zone.x, y: zone.y - 1 });
  });

  const blockProbability = 0.5;
  const blockHasPowerUp = 0.6;

  for (let row = 1; row < GRID_ROWS - 1; row++) {
    for (let col = 1; col < GRID_COLS - 1; col++) {
      const cell = map[row][col];

      const isSafeZone = extendedSafeZones.some(zone => 
        zone.x === col && zone.y === row
      );

      if (cell.type === 'empty' && !isSafeZone && Math.random() < blockProbability) {
        const newBlock = {
          type: 'block', 
          row, 
          col, 
          destroyable: true,
          hasPowerup: Math.random() < blockHasPowerUp,
          powerupType: null
        }

        if (newBlock.hasPowerup) {
          newBlock.powerupType = getRandomPowerupType();
        }
  
        map[row][col] = newBlock;
      }
    }
  }

  return map;
}

export function analyzeMap(map) {
  const flatMap = map.flat();
  return {
    totalCells: flatMap.length,
    borderCount: flatMap.filter(cell => cell.type === 'border').length,
    wallCount: flatMap.filter(cell => cell.type === 'wall').length,
    blockCount: flatMap.filter(cell => cell.type === 'block').length,
    emptyCount: flatMap.filter(cell => cell.type === 'empty').length,
    powerupCount: flatMap.filter(cell => cell.type === 'powerup').length,
    blocksWithPowerups: flatMap.filter(cell => cell.type === 'block' && cell.hasPowerup).length
  };
}