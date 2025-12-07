import { h } from "../../framework/dom.js";
import { useEffect, useState, useRef } from "../../framework/hooks.js";
import { GRID_COLS, GRID_ROWS, CELL_SIZE } from "../Methods/mapGenerator.js";
import { getSocket } from "../services/ws.js";

/* ---------------------- Character Sprite Paths ---------------------- */
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

/* ---------------------- Helpers ---------------------- */
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

function seedForIndex(gameMap, idx) {
  const R = gameMap.length;
  const C = gameMap[0].length;
  const seeds = [
    { r: 1, c: 1 }, // top-left
    { r: 1, c: C - 2 }, // top-right
    { r: R - 2, c: 1 }, // bottom-left
    { r: R - 2, c: C - 2 }, // bottom-right
  ];
  const seed = seeds[idx % seeds.length];

  if (isWalkable(gameMap[seed.r]?.[seed.c])) {
    return seed;
  }

  const walkablePos = findNearestWalkable(gameMap, seed.r, seed.c, 3);
  return walkablePos || { r: 1, c: 1 };
}

function detectCharacterName(player) {
  const raw = String(player?.character || player?.name || "").toLowerCase();
  if (raw.includes("mario")) return "Mario";
  if (raw.includes("peach")) return "Peach";
  if (raw.includes("yoshi")) return "Yoshi";
  if (raw.includes("toad")) return "Toadette";
  return "Mario";
}

function normalizeName(name) {
  let cleaned = String(name || "").trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.toLowerCase();
}

/* ---------------------- Component ---------------------- */
export default function MyPlayer({ gameMap, players, self }) {
  if (!Array.isArray(gameMap) || gameMap.length === 0) {
    return null;
  }
  if (!Array.isArray(players) || players.length === 0) {
    return null;
  }
  if (!self) {
    return null;
  }
  const gameMapRef = useRef(gameMap);
  const lastWsPositionRef = useRef({ r: -1, c: -1 });
  const charName = detectCharacterName(self);
  const sheet = SPRITES[charName] || SPRITES.Mario;
  const keyHoldTimersRef = useRef({});
  const keyHoldStateRef = useRef({});
  const [speedPowerupUntil, setSpeedPowerupUntil] = useState(0);

  // Find player index for spawn position
  const myIndex = players.findIndex((p) => 
    p && ((self.id != null && p.id === self.id) || 
         normalizeName(p.name) === normalizeName(self.name))
  );

  const seed = seedForIndex(gameMap, myIndex >= 0 ? myIndex : 0);

  const getInitialPosition = () => {
    if (seed && typeof seed === 'object' && typeof seed.r === 'number' && typeof seed.c === 'number') {
      return { r: seed.r, c: seed.c };
    }
    return { r: 1, c: 1 };
  };

  const [pos, setPos] = useState(getInitialPosition);
  const [dir, setDir] = useState("down");
  const posRef = useRef(pos);
  const ws = getSocket();
  posRef.current = pos;

  useEffect(() => {
  try { 
    sessionStorage.setItem("bm_self_rc", JSON.stringify({ r: pos.r, c: pos.c })); 
  } catch (error) {
    console.log("Didn't set position:", error);
  }
}, [pos]);

useEffect(() => {
    gameMapRef.current = gameMap;
  }, [gameMap]);

  // Listen for WebSocket messages
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        if (msg.type === "player-move") {
          const { name, r, c, dir: newDir } = msg.payload;
                
        // Update position if it's our own player
        if (normalizeName(name) === normalizeName(self.name)) {
          if (r === lastWsPositionRef.current.r && c === lastWsPositionRef.current.c) {
            // console.log(`⏭️ DUPLICATE WS POSITION - ignoring`);
            return;
          }
          
          lastWsPositionRef.current = { r, c };
    
          // update direction if it changed
          if (newDir !== dir) {
            setDir(newDir);
          }
        }
        }

        if (msg.type === "powerup-collected"){
          const { playerName, powerupType, expiresAt } = msg.payload;

          //only apply effects if its our player
          if (normalizeName(playerName) === normalizeName(self.name)){

            if (powerupType === 'speed'){
              const newExpiresAt = expiresAt || Date.now() + 10000; 

              if (speedPowerupUntil > Date.now()){
                setSpeedPowerupUntil(prev => prev + 10000); //10 seconds
              }else{
                setSpeedPowerupUntil(newExpiresAt);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [ws, self.name, dir, speedPowerupUntil]);

  // Timer to clear expired speed powerup
  useEffect(() => {
    const interval = setInterval(() => {
      if (speedPowerupUntil > 0 && Date.now() > speedPowerupUntil) {
        setSpeedPowerupUntil(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [speedPowerupUntil]);

  //cleanup key hold timers on unmount
  useEffect(() => {
    return () => {
      Object.values(keyHoldTimersRef.current).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
      keyHoldTimersRef.current = {};
      keyHoldStateRef.current = {};
    }
  }, []);

  /* ---------------------- Movement Logic ---------------------- */
useEffect(() => {
  // const held = new Set();
  let movementLock = false;
  let ignoreAllKeys = false;

      // Check if the target cell is walkable and within bounds
   const canMoveTo = (r, c) => {
      return (
        r >= 0 && r < GRID_ROWS &&
        c >= 0 && c < GRID_COLS &&
        isWalkable(gameMapRef.current[r]?.[c])
      );
    };

  const move = (key, isRepeatMovement = false) => {
    if (movementLock || ignoreAllKeys) {
      return;
    }
        
    let { r, c } = posRef.current;

    if (typeof r !== 'number' || typeof c !== 'number') {
      console.warn('❌ Invalid position detected, resetting to seed');
      const defaultPos = getInitialPosition();
      r = defaultPos.r;
      c = defaultPos.c;
      setPos(defaultPos);
      posRef.current = defaultPos;
      return;
    }

    let newDir = dir;
    let targetR = r;
    let targetC = c;

    // Calculate the target position , one cell away
    if (key === "arrowup" || key === "w") {
      newDir = "up";
      targetR = r - 1;
    } else if (key === "arrowdown" || key === "s") {
      newDir = "down";
      targetR = r + 1;
    } else if (key === "arrowleft" || key === "a") {
      newDir = "left";
      targetC = c - 1;
    } else if (key === "arrowright" || key === "d") {
      newDir = "right";
      targetC = c + 1;
    }

    // Check if speed powerup is active
      const hasSpeedPowerup = speedPowerupUntil > Date.now();
      let finalR = targetR;
      let finalC = targetC;
      //track all cells to be passed through, for powerups collection
      const pathCells = [{ r, c }];

      //2-block movement if speed powerup and key held and 2 blocks are walkable
      if (isRepeatMovement){
        let blocksToMove = 2;

        if (hasSpeedPowerup){
          blocksToMove = 4; //by 4 blocks if has speed powerup
        }

        let multiTargetR = targetR;
        let multiTargetC = targetC;

        // Calculate the double movement position
        if (key === "arrowup" || key === "w") {
          multiTargetR = r - blocksToMove;
        } else if (key === "arrowdown" || key === "s") {
          multiTargetR = r + blocksToMove;
        } else if (key === "arrowleft" || key === "a") {
          multiTargetC = c - blocksToMove;
        } else if (key === "arrowright" || key === "d") {
          multiTargetC = c + blocksToMove;
        }

        // Check if all cells along the path are walkable
        let canMoveMulti = true;

        //check each cell along the path
        for (let i = 1; i <= blocksToMove; i++) {
          let checkR = r;
          let checkC = c;

           if (key === "arrowup" || key === "w") {
            checkR = r - i;
          } else if (key === "arrowdown" || key === "s") {
            checkR = r + i;
          } else if (key === "arrowleft" || key === "a") {
            checkC = c - i;
          } else if (key === "arrowright" || key === "d") {
            checkC = c + i;
          }

          pathCells.push({ r: checkR, c: checkC });

          if (!canMoveTo(checkR, checkC)) {
          canMoveMulti = false;
          break;
        }
      }


      if (canMoveMulti) {
        finalR = multiTargetR;
        finalC = multiTargetC;
      }else{
        // Can't move full distance, try to move as far as possible
        let maxMovable = 1; // Start with 1 block (the initial target)
        for (let i = 1; i <= blocksToMove; i++) {
          let checkR = r;
          let checkC = c;
          
          if (key === "arrowup" || key === "w") {
            checkR = r - i;
          } else if (key === "arrowdown" || key === "s") {
            checkR = r + i;
          } else if (key === "arrowleft" || key === "a") {
            checkC = c - i;
          } else if (key === "arrowright" || key === "d") {
            checkC = c + i;
          }

          if (canMoveTo(checkR, checkC)) {
            maxMovable = i;
            finalR = checkR;
            finalC = checkC;

             // Add this cell to path if we can move here
          if (i > 1) {
            pathCells.push({ r: checkR, c: checkC });
          }
          } else {
            break;
          }
        }

      }
    }else {
      // Single movement, just add the target cell to path
      pathCells.push({ r: targetR, c: targetC });
      finalR = targetR;
      finalC = targetC;
  }

      // Final position check (for single movement or fallback from double movement)
      const canMove = canMoveTo(finalR, finalC);

      if (canMove) {
        movementLock = true;
        ignoreAllKeys = true;
      
      const next = { r: finalR, c: finalC };

      // Check if we're already at this position (prevent duplicate sends)
      if (finalR === posRef.current.r && finalC === posRef.current.c) {
          movementLock = false;
          ignoreAllKeys = false;
          return;
        }

      // collect powerups along the path
      collectPowerupsAlongPath(pathCells);

      posRef.current = next;
      setPos(next);
      setDir(newDir);

      // Update last WS position to prevent processing our own duplicate messages
      lastWsPositionRef.current = next;

      // Broadcast movement to all players
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "move",
            payload: { 
              id: self.id, 
              name: self.name, 
              r: finalR, 
              c: finalC, 
              dir: newDir 
            },
          })
        );
      }

      // Release movement lock after animation delay
      setTimeout(() => {
        movementLock = false;
        ignoreAllKeys = false;
      }, hasSpeedPowerup ? 80 : 100)
    } else {
      // Can't move to that position, but still update direction if it changed
      if (newDir !== dir) {
        setDir(newDir);
      }
    }
  };

  const collectPowerupsAlongPath = (pathCells) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    let collectedCount = 0;

    pathCells.forEach(({ r, c}) => {
      const cell = gameMapRef.current[r]?.[c];

      //check if cell has powerup
      if (cell?.type === "powerup" && cell.powerupType){

        //send powerup collection to server
        ws.send(
          JSON.stringify({
            type: "collect-powerup",
            payload: {
              r,
              c,
              powerupType: cell.powerupType
            }
          })
        );


        collectedCount++;
      }
    });
  }

  const onDown = (e) => {
    if (document.activeElement.tagName.toLowerCase() === "input") return;
    const k = (e.key || "").toLowerCase();
    
    if (!["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d"].includes(k)) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    // IGNORE ALL key events during movement lock
    if (movementLock || ignoreAllKeys) {
      return;
    }
    
    // allow repeat events for hold
     if (!e.repeat) {
      // First key press, always move 1 block
      move(k, false);
    } else {
      // Repeat event (key held) - use speed powerup if available
      move(k, true); // true indicates this is a repeat/hold movement
    }
  };

  const onUp = (e) => {
    if (document.activeElement.tagName.toLowerCase() === "input") return;
    const k = (e.key || "").toLowerCase();

     if (!["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d"].includes(k)) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  };

  // Use capture phase and make it non-passive
  window.addEventListener("keydown", onDown, { capture: true, passive: false });
  window.addEventListener("keyup", onUp, { capture: true, passive: false });
  
  return () => {
    window.removeEventListener("keydown", onDown, { capture: true });
    window.removeEventListener("keyup", onUp, { capture: true });
    //cleanup timers
    Object.values(keyHoldTimersRef.current).forEach(timer => {
      if (timer) clearTimeout(timer);
    });
    keyHoldTimersRef.current = {};
  };
}, [gameMap, ws, players.length, self?.id, dir, speedPowerupUntil]);

  /* ---------------------- Render ---------------------- */
  const renderPos = (typeof pos.r === 'number' && typeof pos.c === 'number') 
    ? pos 
    : getInitialPosition();
    
  const top = renderPos.r * CELL_SIZE;
  const left = renderPos.c * CELL_SIZE;

  return h(
    "div",
    {
      class: "absolute select-none z-20 transition-all duration-100 ease-linear",
      style: `
        top:${top}px;
        left:${left}px;
        width:${CELL_SIZE}px;
        height:${CELL_SIZE}px;
        image-rendering: pixelated;
      `,
    },
    h("img", {
      src: sheet[dir] || sheet.down,
      alt: `${charName}-${dir}`,
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
}
