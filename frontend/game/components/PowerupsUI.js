import { h } from "../../framework/dom.js";
import { useState, useEffect } from "../../framework/hooks.js";
import { CELL_SIZE } from "../Methods/mapGenerator.js";
import { POWERUPS } from "../Methods/PowersUps.js";

export default function PowerupsUI({ gameMap }) {
  const [powerups, setPowerups] = useState([]);

  useEffect(() => {
    if (!Array.isArray(gameMap) || gameMap.length === 0) {
      setPowerups([]);
      return;
    }

    // Extract all powerups from the map 
    const powerupCells = [];
    for (let row = 0; row < gameMap.length; row++) {
      for (let col = 0; col < gameMap[row].length; col++) {
        const cell = gameMap[row][col];
        // Now we're looking for cells that were converted to "powerup" type
        if (cell?.type === "powerup" && cell.powerupType) {
          const powerupData = POWERUPS[cell.powerupType];
          if (powerupData) {
            powerupCells.push({
              row,
              col,
              type: cell.powerupType,
              powerupData: powerupData
            });
          }
        }
      }
    }

    setPowerups(powerupCells);
  }, [gameMap]);

  if (!Array.isArray(gameMap) || gameMap.length === 0 || powerups.length === 0 || !Array.isArray(powerups)) {
    return null;
  }

  return h(
    "div",
    { 
      class: "absolute inset-0 pointer-events-none z-[40]",
      style: `width:${gameMap[0]?.length * CELL_SIZE}px;height:${gameMap.length * CELL_SIZE}px;`
    },
    powerups.map(powerup => {
      const { powerupData, row, col, type } = powerup;
      
      return h("div", {
        key: `powerup-${row}-${col}-${type}`,
        class: "absolute flex items-center justify-center animate-bounce",
        style: `
          width:${CELL_SIZE}px;
          height:${CELL_SIZE}px;
          left:${col * CELL_SIZE}px;
          top:${row * CELL_SIZE}px;
          z-index: 45;
        `,
        "data-powerup-type": type,
        "data-powerup-pos": `${row},${col}`
      }, 
        h("img", {
          src: `../../assets/PowerUps/${powerupData.icon}`,
          alt: powerupData.name,
          class: "w-16 h-16 object-contain drop-shadow-lg",
          style: "image-rendering: pixelated; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));"
        })
      );
    })
  );
}