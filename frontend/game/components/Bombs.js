import { h } from "../../framework/dom.js";
import { useEffect, useRef, useState } from "../../framework/hooks.js";
import { isTypingTarget } from "../utils/dom-helpers.js";
import { CELL_SIZE, GRID_ROWS, GRID_COLS } from "../Methods/mapGenerator.js";

/* ---------- socket helper ---------- */
function getSharedSocket() {
  if (typeof window !== "undefined" && window.__bm_ws) return window.__bm_ws;
  return null;
}

/* ---------- id/name/rc helpers ---------- */
const cleanName = (raw) => (raw || "").replace(/^['"]+|['"]+$/g, "").trim();
const myName = () => cleanName(localStorage.getItem("bm_name"));
const readSelfId = () => { try { return sessionStorage.getItem("bm_selfId"); } catch { return null; } };

// Read from sessionStorage
const readSelfRC = () => {
  try {
    const s = sessionStorage.getItem("bm_self_rc");
    if (!s) return null;
    const obj = JSON.parse(s);
    if (typeof obj?.r === "number" && typeof obj?.c === "number") return obj;
    return null;
  } catch { return null; }
};

function resolveSelfFromPlayers(players) {
  const list = Array.isArray(players) ? players : [];
  const sid = readSelfId();
  if (sid != null) {
    const byId = list.find((p) => String(p?.id) === String(sid));
    if (byId) return byId;
  }
  const me = myName().toLowerCase();
  return list.find((p) => (p?.name || "").trim().toLowerCase() === me) || null;
}

/* ---------- shared local state (kept per-instance) ---------- */
function useBombState() {
  const [bombs, setBombs] = useState([]);
  const [cooling, setCooling] = useState(false);
  const coolUntilRef = useRef(0);
  return { bombs, setBombs, cooling, setCooling, coolUntilRef };
}

/* ---------- util ---------- */
function clampRC(r, c, gameMap) {
  const rows = Array.isArray(gameMap) && gameMap.length ? gameMap.length : Number(GRID_ROWS) || 0;
  const cols = rows
    ? (Array.isArray(gameMap) && Array.isArray(gameMap[0]) ? gameMap[0].length : Number(GRID_COLS) || 0)
    : 0;

  const rr = Math.max(0, Math.min(r ?? 0, rows ? rows - 1 : 0));
  const cc = Math.max(0, Math.min(c ?? 0, cols ? cols - 1 : 0));
  return { r: rr, c: cc };
}

/* ---------- view bits ---------- */
function BombsLayer({ bombs, iconSrc = "/assets/bomb.png" }) {
  if (!Array.isArray(bombs) || bombs.length === 0) return null;
  bombs = bombs.filter((b) => b && b.id != null);
  return h(
    "div",
    { class: "absolute inset-0 pointer-events-none z-[35]" },
    bombs.map((b) =>
      h("img", {
        key: b.id,
        src: iconSrc,
        alt: "bomb",
        class: "absolute select-none",
        style: `
          width:${CELL_SIZE}px;height:${CELL_SIZE}px;
          left:${b.c * CELL_SIZE}px;top:${b.r * CELL_SIZE}px;
          image-rendering: pixelated;
        `,
        "data-bomb-id": b.id,
      })
    )
  );
}

function BombsButton({ onClick, cooling, iconSrc = "/assets/bomb.png" }) {
  return h(
    "div",
    {
      class: "fixed right-6 bottom-6",
      style: "z-index:2147483647; pointer-events:auto;",
    },
    h(
      "button",
      {
        "aria-label": "Drop bomb",
        id: "bomb-button",
        class: `
          relative flex items-center justify-center
          w-20 h-20 rounded-full bg-black/50 border border-white/30
          shadow-[0_6px_15px_rgba(0,0,0,.4)] backdrop-blur
          hover:scale-105 active:scale-95 transition-transform
          ${cooling ? "opacity-60 pointer-events-none" : "pointer-events-auto"}
        `,
        onClick,
      },
      h("img", { src: iconSrc, alt: "bomb", class: "w-10 h-10 select-none" }),
      h("span", { class: "absolute -top-6 text-[10px] text-yellow-200 tracking-widest" }, "space")
    )
  );
}

/* ---------- main component ---------- */
export default function Bombs({
  gameMap,
  players,
  bombs,
  setBombs,
  playerPowerups,
  disableHotkey = false,
  cooldownMs = 5000,
  iconSrc = "/assets/bomb.png",
  renderLayer = true,
  renderButton = true,
  onBombExplode,
  onPlaceBomb, 
}) {
  
  // const bombTimeoutsRef = useRef(new Set());
  // const cooldownIntervalsRef = useRef(new Set());
  const { cooling, setCooling, coolUntilRef } = useBombState();

// const addBombTimeout = (timeout) => {
//   console.log('🕒 addBombTimeout called, bombTimeoutsRef.current type:', typeof bombTimeoutsRef.current);
//   console.log('🕒 bombTimeoutsRef.current:', bombTimeoutsRef.current);
  
//   if (!bombTimeoutsRef.current) {
//     console.log('🔄 Creating new Set for bombTimeoutsRef');
//     bombTimeoutsRef.current = new Set();
//   } else if (typeof bombTimeoutsRef.current.add !== 'function') {
//     console.log('❌ bombTimeoutsRef.current is not a Set, recreating. Type:', typeof bombTimeoutsRef.current);
//     bombTimeoutsRef.current = new Set();
//   }
  
//   bombTimeoutsRef.current.add(timeout);
//   console.log('✅ Timeout added successfully');
// };

//   const addCooldownInterval = (interval) => {
//     if (!cooldownIntervalsRef.current) {
//       cooldownIntervalsRef.current = new Set();
//     }
//     cooldownIntervalsRef.current.add(interval);
//   };

function startCooldown(ownerName) {
  const ms = getEffectiveCooldownMs(ownerName, Number(cooldownMs) || 900);

    const until = Date.now() + ms;
    coolUntilRef.current = until;
    setCooling(true);
    
    setTimeout(() => {
      if (Date.now() >= coolUntilRef.current) setCooling(false);
    }, ms + 50);
  }

  // useEffect(() => {
  //   if (!cooling) return;
    
  //   // STORE INTERVAL FOR CLEANUP
  //   const t = setInterval(() => {
  //     if (Date.now() >= coolUntilRef.current) {
  //       setCooling(false);
  //       clearInterval(t);
  //       if (cooldownIntervalsRef.current && cooldownIntervalsRef.current.delete) {
  //         cooldownIntervalsRef.current.delete(t);
  //       }
  //     }
  //   }, 120);
    
  //   addCooldownInterval(t);
    
  //   return () => {
  //     clearInterval(t);
  //     if (cooldownIntervalsRef.current && cooldownIntervalsRef.current.delete) {
  //       cooldownIntervalsRef.current.delete(t);
  //     }
  //   };
  // }, [cooling]);

  function activeFlameBonusFor(ownerName) {
     const now = Date.now();
     const pu = playerPowerups?.[ownerName] || {};
     const flames = Array.isArray(pu.flame) ? pu.flame : [];
     const active = flames.filter(p => p && p.expiresAt > now);
     // +1 range if at least one flame is active
     return active.length > 0 ? 1 : 0;
  }

  function activeBombStacksFor(ownerName) {
    const now = Date.now();
    const pu = playerPowerups?.[ownerName] || {};
    const bombs = Array.isArray(pu.bomb) ? pu.bomb : [];
    // Count only active (unexpired) bomb powerups
    return bombs.filter(p => p && p.expiresAt > now).length;
  }

  function getEffectiveCooldownMs(ownerName, base = 900) {
    const stacks = activeBombStacksFor(ownerName);
    if (stacks <= 0) return base;
    // one stack -> 300ms
    return 300;
  }

  function getMaxConcurrentBombs(ownerName, base = 1) {
    const stacks = activeBombStacksFor(ownerName);
    if (stacks <= 0) return base;
    // one stack -> 3 concurrent bombs
    return 3;
  }

  function placeBomb() {
    
    if (cooling) { 
      return; 
    }
 if (typeof onPlaceBomb === "function") {
    onPlaceBomb();
  }
    // Get current position from sessionStorage (where MyPlayer saves it)
    const currentRC = readSelfRC();
    const self = resolveSelfFromPlayers(players);

    if (!currentRC && !self) {
      return;
    }

    const ownerName = self?.name || myName() || "unknown";
    const ownerId = self?.id || readSelfId() || "local";
    // limit concurrent bombs by me
    const maxByMe = getMaxConcurrentBombs(ownerName, 1);
    const activeByMe = (Array.isArray(bombs) ? bombs : []).filter(
      b => b && b.owner === ownerName && Date.now() < (b.explodeAt || 0)
    ).length;

    if (activeByMe >= maxByMe) {
      return;
    }

    const flameBonus = activeFlameBonusFor(ownerName);
    const range = 1 + flameBonus;
    // Use live player position if available, otherwise fall back to sessionStorage
    let finalR, finalC;
    
    if (self && typeof self.r === 'number' && typeof self.c === 'number') {
      // Use live position from players array
      finalR = self.r;
      finalC = self.c;
    } else if (currentRC) {
      // Use sessionStorage position
      finalR = currentRC.r;
      finalC = currentRC.c;
    } else {
      return;
    }

    // Clamp to valid grid coordinates
    const clamped = clampRC(finalR, finalC, gameMap);
    finalR = clamped.r;
    finalC = clamped.c;

    // optimistic local bomb (2s fuse)
    const now = Date.now();
    const bomb = {
      id: `${ownerId}-${now}`,
      r: finalR,
      c: finalC,
      owner: ownerName,
      armAt: now,
      explodeAt: now + 2000,
    };
    
    // STORE BOMB TIMEOUT (without tracking it)
    setTimeout(() => {
      // Remove bomb
      setBombs((bs) => {
        const currentBombs = Array.isArray(bs) ? bs : [];
        return currentBombs.filter((b) => b.id !== bomb.id);
      });

      // TRIGGER EXPLOSION CALLBACK
    if (onBombExplode) { onBombExplode(finalR, finalC, range); }


      // NOTIFY SERVER ABOUT EXPLOSION
      const ws = getSharedSocket();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ 
          type: "bomb-explode", 
          payload: { 
            r: finalR, 
            c: finalC,
            range
          } 
        }));
      }
    }, 2000);

    // notify server about bomb placement
    const ws = getSharedSocket();
    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ 
          type: "place-bomb", 
          payload: { 
            r: finalR, 
            c: finalC,
            owner: ownerName,
            ownerId: ownerId,
            range
          } 
        }));
      }
    } catch (e) {
      console.log("❌ [Bombs] ws error", e);
    }

  startCooldown(ownerName);  
}

  /* Space/B hotkey */
  useEffect(() => {
    function onKey(e) {
      const k = e.key?.toLowerCase();
      const typing = isTypingTarget(e.target);
      
      if (disableHotkey || typing) return;
      if ((k === " " || k === "b")&& cooling) { //shouldn't it be !cooling???
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        placeBomb();
      }
    }
    
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [disableHotkey, players, gameMap, cooling]);

  /* Listen for server-confirmed bombs */
  useEffect(() => {
    const ws = getSharedSocket();
    if (!ws) return;

    const onMessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      
      if (msg?.type === "bomb-placed") {
        const { r, c, owner, id, fuseMs = 2000 } = msg.payload || {};
        if (typeof r !== "number" || typeof c !== "number") return;

        const now = Date.now();
        const bid = id || `${owner || "srv"}-${now}`;
        
        // Don't duplicate if we already have this bomb locally
        setBombs((bs) => {
          const currentBombs = Array.isArray(bs) ? bs : [];
          const exists = currentBombs.find(b => b.id === bid);
          if (exists) return currentBombs;
          // LIMIT BOMBS TO PREVENT MEMORY LEAK
          const limitedBombs = [...currentBombs, { id: bid, r, c, owner, armAt: now, explodeAt: now + fuseMs }].slice(-5);
          return limitedBombs;
        });
        
         // STORE SERVER BOMB TIMEOUT (without tracking it)
        setTimeout(() => {
          setBombs((bs) => {
            const currentBombs = Array.isArray(bs) ? bs : [];
            return currentBombs.filter((b) => b.id !== bid);
          });
          
          if (onBombExplode) {
            onBombExplode(r, c);
          }
        }, fuseMs + 120);

      //  addBombTimeout(serverBombTimeout);
      }
      
      // HANDLING FOR SERVER-TRIGGERED EXPLOSIONS
    if (msg?.type === "bomb-explode") {
      const { r, c, range = 1, explosionCells } = msg.payload || {};
    if (typeof r === "number" && typeof c === "number" && onBombExplode) {
      onBombExplode(r, c, range, explosionCells);
    }
  }

    };

    ws.addEventListener("message", onMessage);
    return () => { 
      try { ws.removeEventListener("message", onMessage); } catch {} 
    };
  }, [onBombExplode]);

  // CLEANUP EFFECT
  // useEffect(() => {
  //   return () => {
  //     // Cleanup all bomb timeouts when component unmounts
  //     if (bombTimeoutsRef.current) {
  //       bombTimeoutsRef.current.forEach(timeout => {
  //         clearTimeout(timeout);
  //       });
  //       bombTimeoutsRef.current.clear();
  //     }
      
  //    // Cleanup all cooldown intervals
  //     if (cooldownIntervalsRef.current) {
  //       cooldownIntervalsRef.current.forEach(interval => {
  //         clearInterval(interval);
  //       });
  //       cooldownIntervalsRef.current.clear();
  //     }
  //   };
  // }, []);

  // Render based on flags
  return h(
    "div",
    { class: "contents" },
    renderLayer ? BombsLayer({ bombs, iconSrc }) : null,
    renderButton ? BombsButton({ onClick: placeBomb, cooling, iconSrc }) : null
  );
}