import { h } from "../../framework/dom.js";
import { useState, useEffect, useRef } from "../../framework/hooks.js";
import { CELL_SIZE } from "../Methods/mapGenerator.js";

export default function Explosions({ gameMap, bombExplosions = [] }) {
  const [explosions, setExplosions] = useState([]);
  const explosionTimeoutsRef = useRef(new Set());

  // Calculate explosion pattern (up, down, left, right)
  const getExplosionCells = (centerR, centerC, range = 1) => {
    if (!Array.isArray(gameMap) || gameMap.length === 0) {
      console.warn("❌ Explosions: gameMap is not ready yet");
      return [{ r: centerR, c: centerC }];
    }
    
    const cells = [{ r: centerR, c: centerC }];
    const directions = [
      { r: -1, c: 0 },  // up
      { r: 1, c: 0 },   // down
      { r: 0, c: -1 },  // left
      { r: 0, c: 1 }    // right
    ];

    directions.forEach((dir) => {
      for (let i = 1; i <= range; i++) {
        const r = centerR + (dir.r * i);
        const c = centerC + (dir.c * i);
        
        if (r < 0 || r >= gameMap.length || c < 0 || c >= (gameMap[0]?.length || 0)) break;
        
        const cell = gameMap[r]?.[c];
        if (cell?.type === "wall" || cell?.type === "border") break;
        
        cells.push({ r, c });
        
        if (cell?.type === "block") break;
      }
    });

    return cells;
  };

  // Destroy blocks in explosion path
  // const destroyBlocks = (explosionCells) => {
  //   if (!setGameMap) return;

  //   setGameMap(prevMap => {
  //     if (!Array.isArray(prevMap) || prevMap.length === 0) {
  //       console.warn("❌ Explosions: Cannot destroy blocks - map not ready");
  //       return prevMap;
  //     }
      
  //     const newMap = JSON.parse(JSON.stringify(prevMap));
  //     let blocksDestroyed = false;
      
  //     explosionCells.forEach(({ r, c }) => {
  //       if (newMap[r]?.[c]?.type === "block") {

  //         const block = newMap[r][c];

  //         //check if block has power up and spawn it
  //         if (block.hasPowerup && block.powerupType) {
  //         newMap[r][c] = { 
  //           type: "powerup",  // change destroyed block into powerup if it has one
  //           row: r, 
  //           col: c, 
  //           powerupType: block.powerupType,
  //           destroyable: false
  //         };
  //         console.log(`🎁 Powerup spawned at (${r}, ${c}): ${block.powerupType}`);
  //       } else {
  //         // Regular block without powerup becomes empty
  //         newMap[r][c] = { type: "empty", row: r, col: c };
  //       }

  //       blocksDestroyed = true;
  //       }
  //     });

  //      if (blocksDestroyed) {
  //     console.log("🗺️ Map updated after block destruction");
  //   }
      
  //     return newMap;
  //   });
  // };

  // Handle bomb explosion, visual, no map update
  const triggerExplosion = (centerR, centerC, range = 1, explosionCells = null) => {
    if (!Array.isArray(gameMap) || gameMap.length === 0) {
      console.warn("❌ Explosions: Cannot trigger explosion - map not ready");
      return;
    }
    
    const cells = explosionCells || getExplosionCells(centerR, centerC, range);
    
    // Destroy blocks
    // destroyBlocks(cells);
    
    // Show explosion animation only
    const explosionId = `explosion-${centerR}-${centerC}-${Date.now()}`;
    const newExplosion = {
      id: explosionId,
      cells: cells,
      startTime: Date.now(),
      duration: 500
    };

    setExplosions(prev => {
      const currentExplosions = Array.isArray(prev) ? prev : [];
      // LIMIT EXPLOSIONS TO PREVENT MEMORY LEAK
      const limitedExplosions = [...currentExplosions, newExplosion].slice(-10); // Keep only last 10 explosions
      return limitedExplosions;
    });

    // STORE TIMEOUT FOR CLEANUP
    const explosionTimeout = setTimeout(() => {
      setExplosions(prev => {
        const currentExplosions = Array.isArray(prev) ? prev : [];
        return currentExplosions.filter(exp => exp.id !== explosionId);
      });
      // REMOVE TIMEOUT FROM REF AFTER EXECUTION
      explosionTimeoutsRef.current.delete(explosionTimeout);
    }, newExplosion.duration);

    // TIMEOUT TO REF FOR CLEANUP
    explosionTimeoutsRef.current.add(explosionTimeout);
  };

  // Listen for bomb explosions from server
  useEffect(() => {
    if (Array.isArray(bombExplosions) && bombExplosions.length > 0) {
      bombExplosions.forEach(({ r, c, range = 1, explosionCells }) => {
        if (typeof r === "number" && typeof c === "number") {
          triggerExplosion(r, c, range, explosionCells);
        }
      });
    }
  }, [bombExplosions]);

  // CLEANUP
  useEffect(() => {
    return () => {
      // Cleanup all explosion timeouts when component unmounts
      explosionTimeoutsRef.current.forEach(timeout => {
        clearTimeout(timeout);
      });
      explosionTimeoutsRef.current.clear();
    };
  }, []);

  // Render explosion animation
  const ExplosionLayer = () => {
    if (!Array.isArray(gameMap) || gameMap.length === 0) {
      return null;
    }

    const safeExplosions = Array.isArray(explosions) ? explosions : [];

    if (safeExplosions.length === 0) {
      return null;
    }

return h(
  "div",
  { 
    class: "absolute inset-0 pointer-events-none z-[50]", // bumped above players/bombs
    style: `width:${gameMap[0]?.length * CELL_SIZE}px;height:${gameMap.length * CELL_SIZE}px;`
  },
  safeExplosions.flatMap(explosion => {
    if (!explosion?.cells || !Array.isArray(explosion.cells)) return [];
    return explosion.cells.map(cell =>
      h("div", {
        key: `${explosion.id}-${cell.r}-${cell.c}`,
        class: "absolute bg-red-500 bg-opacity-70 animate-pulse",
        style: `
          width:${CELL_SIZE}px;
          height:${CELL_SIZE}px;
          left:${cell.c * CELL_SIZE}px;
          top:${cell.r * CELL_SIZE}px;
          image-rendering: pixelated;
          outline:2px solid rgba(255,0,0,.6);
          filter: drop-shadow(0 0 6px rgba(255,0,0,.9));
        `,
        "data-explosion-cell": `${cell.r},${cell.c}`
      })
    );
  })
);

  };

  return ExplosionLayer();
}