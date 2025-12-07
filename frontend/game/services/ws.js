import BomberMario from "../Pages/BomberMario.js";


export function getSocket() {
  try {
    if (BomberMario && BomberMario.__socket) return BomberMario.__socket;
  } catch {}

  if (typeof window !== "undefined" && window.__bm_ws) return window.__bm_ws;

  return null; // not connected yet
}

// Send a message safely through WebSocket if open
export function sendWS(obj) {
  const ws = getSocket();
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  } else {
    console.warn("⚠️ WebSocket not open — message skipped:", obj);
  }
}

/**
 * Check if the socket is open and usable
 */
export function guardOpen() {
  const ws = getSocket(); 
  return !!(ws && ws.readyState === WebSocket.OPEN);
}

/**
 *store a socket manually (used if you want to assign window.__bm_ws from lobby)
 */
export function setSocket(ws) {
  try {
    if (BomberMario) BomberMario.__socket = ws;
    if (typeof window !== "undefined") window.__bm_ws = ws;
  } catch {}
}
