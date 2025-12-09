// bomberman/services/ws.js
import BomberMario from "../Pages/BomberMario.js";

let cachedSocket = null;

/**
 * Compute the current roomId for this client.
 * Priority:
 *  1) window.__bm_roomId (set by Next.js /game page)
 *  2) ?roomId= in the URL
 *  3) "default"
 */
function getRoomId() {
  let roomId = "default";

  if (typeof window === "undefined") {
    return roomId;
  }

  try {
    // 1) Global set by the Next.js GamePage
    if (window.__bm_roomId) {
      return String(window.__bm_roomId);
    }

    // 2) Query string
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("roomId");
    if (fromQuery) {
      roomId = fromQuery;
    }
  } catch {
    // ignore, keep default
  }

  return roomId || "default";
}

/**
 * Internal helper to create a new WebSocket for the current room
 */
function createSocketForRoom() {
  if (typeof window === "undefined") return null;

  const loc = window.location;
  const protocol = loc.protocol === "https:" ? "wss:" : "ws:";
  const host = loc.host;
  const roomId = getRoomId();

  const wsUrl = `${protocol}//${host}/ws?roomId=${encodeURIComponent(
    roomId
  )}`;

  const ws = new WebSocket(wsUrl);

  // cache and expose globally
  cachedSocket = ws;
  try {
    if (BomberMario) BomberMario.__socket = ws;
  } catch {}
  try {
    window.__bm_ws = ws;
  } catch {}

  // Optional: small debug logs
  ws.addEventListener("open", () => {
    console.log("[WS] Connected to room:", roomId);
  });
  ws.addEventListener("close", () => {
    console.log("[WS] Closed for room:", roomId);
    // We don't immediately null cachedSocket here so that callers can see CLOSED.
    // Next call to getSocket() will recreate a new one.
  });
  ws.addEventListener("error", (err) => {
    console.warn("[WS] Error:", err);
  });

  return ws;
}

/**
 * Get the shared WebSocket.
 * - Reuses an existing open one if possible
 * - Otherwise tries BomberMario.__socket / window.__bm_ws
 * - If still none, creates a new WebSocket for the current room
 */
export function getSocket() {
  // 1) Reuse cached if not fully CLOSED
  if (
    cachedSocket &&
    cachedSocket.readyState !== WebSocket.CLOSED
  ) {
    return cachedSocket;
  }

  // 2) Try BomberMario.__socket
  try {
    if (
      BomberMario &&
      BomberMario.__socket &&
      BomberMario.__socket.readyState !== WebSocket.CLOSED
    ) {
      cachedSocket = BomberMario.__socket;
      return cachedSocket;
    }
  } catch {}

  // 3) Try window.__bm_ws
  if (typeof window !== "undefined") {
    const w = window.__bm_ws;
    if (w && w.readyState !== WebSocket.CLOSED) {
      cachedSocket = w;
      return cachedSocket;
    }
  }

  // 4) Nothing usable -> create a new one (for this roomId)
  return createSocketForRoom();
}

/**
 * Send a message safely through WebSocket if open
 */
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
 * Store a socket manually (used if you want to assign window.__bm_ws from lobby)
 */
export function setSocket(ws) {
  cachedSocket = ws;
  try {
    if (BomberMario) BomberMario.__socket = ws;
  } catch {}
  try {
    if (typeof window !== "undefined") window.__bm_ws = ws;
  } catch {}
}
