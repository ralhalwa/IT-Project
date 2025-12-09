import { h } from "../../framework/dom.js";
import { useState, useEffect, useRef, useLocalStorageState } from "../../framework/hooks.js";
import { useErrorPopup, showError } from "../components/ErrorPopup.js";

import RightRail from "../components/RightRail.js";
import QuickChatPopover from "../components/QuickChatPopover.js";
import AudioPanel from "../components/AudioPanel.js";
import LeftHud from "../components/LeftHud.js";
import MapGrid from "../components/MapGrid.js";

import { getSocket } from "../services/ws.js";
import { createRTC } from "../services/webrtc.js";
import { asArray, isTypingTarget } from "../utils/dom-helpers.js";
import { generateMap } from "../Methods/mapGenerator.js";
import PlayerSprites from "../components/PlayerSprites.js";
import MyPlayer from "../components/MyPlayer.js";
import PowerUpsSection from "../components/PowerUpsSection.js";
import Bombs from "../components/Bombs.js";
import Explosions from "../components/Explosions.js";
import PowerupsUI from "../components/PowerupsUI.js";
import ActivePowerupsIndicator from "../components/ActivePowerupsIndicator.js";
import InfoOverlay from "../components/InfoOverlay.js";
import SoundPanel from "../components/SoundPanel.js";
import { navigate } from "../../framework/router.js";

const BOMB_COOLDOWN_MS = 5000;
const POWERUP_DURATION_MS = 10000;

/* ---------- Audio Manager ---------- */

// Create a global audio manager that handles all sound effects
class AudioManager {
  constructor() {
    this.sounds = {};
    this.volume = 0.7; // Default volume
    this.muted = false;
    this.initSounds();
  }

  initSounds() {
    // Create audio objects for all sound effects
    this.sounds = {
      powerup: this.createAudio("/audio/01-power-up-mario.mp3"),
      damage: this.createAudio("/audio/mario-damage.mp3"),
      explosion: this.createAudio("/audio/ExplosionSound.mp3"),
      placeBomb: this.createAudio("/audio/PlaceBombSound.mp3")
    };
  }

  createAudio(src) {
    const audio = new Audio();
    audio.src = src;
    audio.preload = "auto";
    audio.volume = this.muted ? 0 : this.volume;
    return audio;
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
  }

  setMuted(muted) {
    this.muted = muted;
    this.updateAllVolumes();
  }

  updateAllVolumes() {
    Object.values(this.sounds).forEach(audio => {
      if (audio) {
        audio.volume = this.muted ? 0 : this.volume;
      }
    });
  }

  play(soundName) {
    if (this.muted || this.volume <= 0) {
      return; // Don't play if muted or volume is 0
    }

    const audio = this.sounds[soundName];
    if (!audio) return;

    try {
      // Reset audio to start
      audio.currentTime = 0;
      
      // Play the sound
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn(`Failed to play ${soundName}:`, err);
        });
      }
    } catch (err) {
      console.error(`Error playing ${soundName}:`, err);
    }
  }

  playPowerup() { this.play("powerup"); }
  playDamage() { this.play("damage"); }
  playExplosion() { this.play("explosion"); }
  playPlaceBomb() { this.play("placeBomb"); }
}

// Create a singleton instance
let audioManager = null;
const getAudioManager = () => {
  if (!audioManager) {
    audioManager = new AudioManager();
  }
  return audioManager;
};

/* ---------- helpers ---------- */

function getSharedSocket() {
  try {
    const s = typeof getSocket === "function" ? getSocket() : null;
    if (s) return s;
  } catch {}
  if (typeof window !== "undefined" && window.__bm_ws) return window.__bm_ws;
  return null;
}
const isValidMap = (m) =>
  Array.isArray(m) && m.length > 0 && Array.isArray(m[0]);
const myName = () => {
  const raw = (localStorage.getItem("bm_name") || "").trim();
  return raw.replace(/^['"]+|['"]+$/g, "").trim();
};
const readSelfId = () => {
  try {
    return sessionStorage.getItem("bm_selfId");
  } catch {
    return null;
  }
};

/* ---------- component ---------- */

export default function Game() {
  const [livesMap, setLivesMap] = useState({});
  const [iFrameUntil, setIFrameUntil] = useState(0);
  const [gameMap, setGameMap] = useState(() => generateMap());
  const [players, setPlayers] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [bombCooling, setBombCooling] = useState(false);
  const [bombs, setBombs] = useState([]);
  const [playerPowerups, setPlayerPowerups] = useState({});
  const [playerPositions, setPlayerPositions] = useState({});
  const [showQuickChat, setShowQuickChat] = useState(false);
  const [quickText, setQuickText] = useState("");
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const [micOn, _setMicOn] = useState(false);
  const [mutedMap, setMutedMap] = useState({});
  const [gameOver, setGameOver] = useLocalStorageState("bm_gameover_v2",{});
  const [showInfo, setShowInfo] = useState(false);
  const [showSoundPanel, setShowSoundPanel] = useState(false);
  
  // Audio manager ref
  const audioManagerRef = useRef(null);
  if (!audioManagerRef.current) {
    audioManagerRef.current = getAudioManager();
  }
  
  // Initialize volumes with safe defaults
  const [volumes, setVolumes] = useState(() => {
    // Helper to safely parse volume from localStorage
    const safeParse = (key, defaultValue) => {
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          const val = parseFloat(saved);
          return !isNaN(val) && isFinite(val) && val >= 0 && val <= 1 ? val : defaultValue;
        }
      } catch {}
      return defaultValue;
    };
    
    return {
      gameMusic: safeParse('bm_gameMusic_vol', 0.3),
      soundEffects: safeParse('bm_sfx_vol', 0.7),
      voiceChat: safeParse('bm_voice_vol', 0.8)
    };
  });
  
  // Audio refs
  const gameMusicRef = useRef(null);

  // WebRTC refs
  const peersRef = useRef({});
  const remoteAudiosRef = useRef({});
  const localStreamRef = useRef(null);
  const selfIdRef = useRef(null);

  const getMicOn = () => micOn;
  const setMicOn = (v) => _setMicOn(v);
  const getPlayers = () => players;
  const getMutedNameMap = () => mutedMap;

  const rtcRef = useRef(null);
  if (!rtcRef.current) {
    rtcRef.current = createRTC({
      peersRef,
      remoteAudiosRef,
      localStreamRef,
      selfIdRef,
      getPlayers,
      getMutedNameMap,
      getMicOn,
      setMicOn,
    });
  }
  const rtc = rtcRef.current;

  // Helper to get safe volume value
  const getSafeVolume = (value, defaultValue = 0.5) => {
    const num = Number(value);
    return !isNaN(num) && isFinite(num) && num >= 0 && num <= 1 ? num : defaultValue;
  };

  // Initialize volumes from localStorage on mount
  useEffect(() => {
    const loadVolumes = () => {
      try {
        const savedMusic = localStorage.getItem('bm_gameMusic_vol');
        const savedSfx = localStorage.getItem('bm_sfx_vol');
        const savedVoice = localStorage.getItem('bm_voice_vol');
        
        const newVolumes = {
          gameMusic: getSafeVolume(savedMusic, 0.3),
          soundEffects: getSafeVolume(savedSfx, 0.7),
          voiceChat: getSafeVolume(savedVoice, 0.8)
        };
        setVolumes(newVolumes);
        
        // Update audio manager with loaded volume
        if (audioManagerRef.current) {
          audioManagerRef.current.setVolume(newVolumes.soundEffects);
          audioManagerRef.current.setMuted(newVolumes.soundEffects === 0);
        }
        
        // Update game music
        if (gameMusicRef.current) {
          gameMusicRef.current.volume = newVolumes.gameMusic;
        }
        
        // Update WebRTC audio volumes
        if (rtc?.setRemoteVolume) {
          rtc.setRemoteVolume(newVolumes.voiceChat);
        }
      } catch (e) {
        console.warn('Failed to load sound settings:', e);
      }
    };
    
    loadVolumes();
  }, []);

  // Function to update all audio volumes safely
  const updateAudioVolumes = (newVolumes) => {
    const safeVolumes = {
      gameMusic: getSafeVolume(newVolumes.gameMusic, 0.3),
      soundEffects: getSafeVolume(newVolumes.soundEffects, 0.7),
      voiceChat: getSafeVolume(newVolumes.voiceChat, 0.8)
    };
    
    setVolumes(safeVolumes);
    
    // Update game music
    if (gameMusicRef.current) {
      gameMusicRef.current.volume = safeVolumes.gameMusic;
    }
    
    // Update audio manager
    if (audioManagerRef.current) {
      audioManagerRef.current.setVolume(safeVolumes.soundEffects);
      audioManagerRef.current.setMuted(safeVolumes.soundEffects === 0);
    }
    
    // Update WebRTC audio volumes
    if (rtc?.setRemoteVolume) {
      rtc.setRemoteVolume(safeVolumes.voiceChat);
    }
    
    // Save to localStorage
    try {
      localStorage.setItem('bm_gameMusic_vol', safeVolumes.gameMusic.toString());
      localStorage.setItem('bm_sfx_vol', safeVolumes.soundEffects.toString());
      localStorage.setItem('bm_voice_vol', safeVolumes.voiceChat.toString());
    } catch {}
  };

  // Sound playing functions using the audio manager
  const playDamageSound = () => {
    audioManagerRef.current?.playDamage();
  };

  const playPowerupSound = () => {
    audioManagerRef.current?.playPowerup();
  };

  const playExplosionSound = () => {
    audioManagerRef.current?.playExplosion();
  };

  const playPlaceBombSound = () => {
    audioManagerRef.current?.playPlaceBomb();
  };

  function handleBombExplode(r, c, range = 1, explosionCells = null) {
    setBombExplosions([{ r, c, range, explosionCells }]);
    playExplosionSound();
    const ws = getSharedSocket();
    if (ws && ws.readyState === WebSocket.OPEN) {
      setTimeout(() => {
        ws.send(JSON.stringify({ type: "request-map" }));
        ws.send(JSON.stringify({ type: "request-positions" }));
      }, 100);
    }
  }

  const [bombExplosions, setBombExplosions] = useState([]);

  /* ---------- actions ---------- */

  function toggleQuickChat() {
    setShowQuickChat((o) => {
      const n = !o;
      if (n) {
        setQuickText("");
        setShowAudioPanel(false);
        setShowSoundPanel(false);
        rtc?.setMicState?.(false);
      }
      return n;
    });
  }

  function closeQuickChat() {
    setShowQuickChat(false);
    setQuickText("");
  }

  function toggleAudioPanel() {
    setShowAudioPanel((o) => {
      const n = !o;
      if (n) {
        setShowQuickChat(false);
        setShowSoundPanel(false);
        setQuickText("");
        rtc?.syncMuteStatesToAudios?.(players, mutedMap);
      }
      return n;
    });
  }

  function toggleSoundPanel() {
    setShowSoundPanel((o) => {
      const n = !o;
      if (n) {
        setShowQuickChat(false);
        setShowAudioPanel(false);
        setQuickText("");
        rtc?.setMicState?.(false);
      }
      return n;
    });
  }

  function sendQuickChat() {
    const ws = getSharedSocket();
    const text = quickText.trim();
    if (!ws || ws.readyState !== WebSocket.OPEN || !text) return;
    if (text.length > 50) return showError("Message too long (max 50)");
    ws.send(JSON.stringify({ type: "chat", payload: { text } }));
    setQuickText("");
    setShowQuickChat(false);
  }

  function sendChat() {
    const ws = getSharedSocket();
    const text = chatInput.trim();
    if (!ws || ws.readyState !== WebSocket.OPEN || !text) return;
    if (text.length > 80) return showError("Message too long (max 80)");
    ws.send(JSON.stringify({ type: "chat", payload: { text } }));
    setChatInput("");
  }

  function toggleMuted(name) {
    setMutedMap((prev) => {
      const next = { ...prev, [name]: !prev?.[name] };
      rtc?.syncMuteStatesToAudios?.(players, next);
      return next;
    });
  }

  /* ---------- powerup handling ---------- */
  useEffect(() => {
    const audio = gameMusicRef.current;
    if (!audio) return;

    audio.loop = true;
    audio.volume = getSafeVolume(volumes.gameMusic, 0.3);

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {});
    }

    return () => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    };
  }, [volumes.gameMusic]);

  useEffect(() => {
    const ws = getSharedSocket();
    if (!ws) return;

    const handleMessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "powerup-collected") {
          const { playerName, powerupType, newCount, expiresAt } = msg.payload;

          if (powerupType === "life") {
            return;
          }

          setPlayerPowerups((prev) => {
            const safePrev = prev && typeof prev === "object" ? prev : {};
            const playerData = safePrev[playerName] || {};
            const existingPowerups = playerData[powerupType] || [];

            const newPowerup = {
              collectedAt: Date.now(),
              expiresAt: expiresAt || Date.now() + POWERUP_DURATION_MS,
            };

            const updated = {
              ...prev,
              [playerName]: {
                ...playerData,
                [powerupType]: [...existingPowerups, newPowerup],
              },
            };
            return updated;
          });

          if (playerName === myName()) {
            playPowerupSound();
          }
        }
      } catch (error) {
        console.error("Error parsing powerup message:", error);
      }
    };

    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlayerPowerups((prev) => {
        if (!prev || typeof prev !== "object") {
          return {};
        }

        const now = Date.now();
        const updated = {};
        let hasChanges = false;

        Object.keys(prev).forEach((playerName) => {
          const playerData = prev[playerName];

          if (!playerData || typeof playerData !== "object") {
            return;
          }

          updated[playerName] = {};

          Object.keys(playerData).forEach((powerupType) => {
            const powerups = playerData[powerupType];
            if (Array.isArray(powerups)) {
              const active = powerups.filter((p) => p.expiresAt > now);
              if (active.length !== powerups.length) {
                hasChanges = true;
              }
              if (active.length > 0) {
                updated[playerName][powerupType] = active;
              }
            }
          });

          if (Object.keys(updated[playerName]).length === 0) {
            delete updated[playerName];
          }
        });

        return hasChanges ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  /* ---------- peer wiring ---------- */

  function reconcilePeers(currentPlayers) {
    if (!selfIdRef.current) return;

    const peers = peersRef.current || {};
    const ids = new Set(
      asArray(currentPlayers)
        .filter((p) => p && p.id && p.id !== selfIdRef.current)
        .map((p) => p.id)
    );

    ids.forEach((id) => {
      if (!peers[id]) rtc?.callPeer?.(id);
      else if (peers[id].signalingState === "closed") {
        try {
          peers[id].close();
        } catch {}
        delete peers[id];
        rtc?.callPeer?.(id);
      }
    });

    Object.keys(peers).forEach((id) => {
      if (!ids.has(id)) {
        try {
          peers[id].close();
        } catch {}
        delete peers[id];
        const a = (remoteAudiosRef.current || {})[id];
        if (a) {
          try {
            a.remove();
          } catch {}
          delete remoteAudiosRef.current[id];
        }
      }
    });
  }

  const readSelfRC = () => {
    try {
      const s = sessionStorage.getItem("bm_self_rc");
      if (!s) return null;
      const obj = JSON.parse(s);
      if (typeof obj?.r === "number" && typeof obj?.c === "number") return obj;
      return null;
    } catch {
      return null;
    }
  };

  function resolveSelfFromPlayers(players) {
    const list = Array.isArray(players) ? players : [];
    const sid = readSelfId();
    if (sid != null) {
      const byId = list.find((p) => String(p?.id) === String(sid));
      if (byId) return byId;
    }
    const me = myName().toLowerCase();
    return (
      list.find((p) => (p?.name || "").trim().toLowerCase() === me) || null
    );
  }

  function clampRC(r, c, gameMap) {
    const rows = Array.isArray(gameMap) && gameMap.length ? gameMap.length : 11;
    const cols = rows
      ? Array.isArray(gameMap[0])
        ? gameMap[0].length
        : 13
      : 13;
    const rr = Math.max(0, Math.min(r ?? 0, rows ? rows - 1 : 0));
    const cc = Math.max(0, Math.min(c ?? 0, cols ? cols - 1 : 0));
    return { r: rr, c: cc };
  }

  useEffect(() => {
    if (players && players.length && Array.isArray(players)) {
      reconcilePeers(players);
      rtc?.syncMuteStatesToAudios?.(players, mutedMap);
    }
  }, [players]);

  function getPlayerCharacter() {
    const self = resolveSelfFromPlayers(players);
    if (!self) return "mario";
    return self.character || "mario";
  }

  /* ---------- autoplay resume ---------- */
  useEffect(() => {
    const resume = () => {
      try {
        document.querySelectorAll("audio").forEach((a) => {
          try {
            a.muted = a.muted && false;
          } catch {}
          try {
            a.play().catch(() => {});
          } catch {}
        });
      } catch {}
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
    };
    window.addEventListener("pointerdown", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });
    return () => {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
    };
  }, []);

  /* ---------- websocket wiring ---------- */

  useEffect(() => {
    const ws = getSharedSocket();
    if (!ws) {
      showError("No WebSocket from lobby — returning to lobby.");
      window.location.href = "/";
      return;
    }

    const onMessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }

      if (msg.type === "start") {
        const list = asArray(msg.payload?.players);
        if (list.length) setPlayers(list);
        const seededLives = {};
        for (const p of list) {
          const v = Number.isFinite(Number(p.lives)) ? Number(p.lives) : 3;
          seededLives[p.id] = v;
        }
        setLivesMap(seededLives);
        const m = msg.payload?.map;
        if (isValidMap(m)) setGameMap(m);

        const me = myName();
        const my = list.find((p) => p?.name === me)?.id || null;
        if (my) selfIdRef.current = my;
        try {
          sessionStorage.setItem("bm_selfId", String(my));
        } catch {}
        rtc?.setMicState?.(false);
        if (list.length) rtc?.startVoiceMesh?.(list);
        rtc?.syncMuteStatesToAudios?.(list, mutedMap);
        return;
      }

      if (Array.isArray(msg?.payload?.players)) {
        const incoming = msg.payload.players;
        if (incoming.length || players.length === 0) {
          setPlayers(incoming);
          if (!selfIdRef.current) {
            const me = myName();
            const my = incoming.find((p) => p?.name === me)?.id || null;
            if (my) selfIdRef.current = my;
          }
          rtc?.startVoiceMesh?.(incoming);
          rtc?.syncMuteStatesToAudios?.(incoming, mutedMap);
        }
      }

      if (
        msg.type === "map" ||
        msg.type === "map-update" ||
        msg.type === "state"
      ) {
        const m = msg?.payload?.map;
        if (isValidMap(m)) setGameMap(m);
        return;
      }

      if (msg.type === "powerup-collected") {
        const { playerName, powerupType, newCount, expiresAt } = msg.payload;

        setPlayerPowerups((prev) => {
          const playerData = prev[playerName] || {};
          const existingPowerups = playerData[powerupType] || [];

          const newPowerup = {
            collectedAt: Date.now(),
            expiresAt: expiresAt || Date.now() + POWERUP_DURATION_MS,
          };

          return {
            ...prev,
            [playerName]: {
              ...playerData,
              [powerupType]: [...existingPowerups, newPowerup],
            },
          };
        });

        if (playerName === myName()) {
          playPowerupSound();
        }
        return;
      }

      if (msg.type === "error") {
        const text = String(msg.message || "");
        if (/nickname/i.test(text)) return;
        showError(text || "Server error");
        return;
      }

      if (msg.type === "chat") {
        const payload = msg.payload || {};
        const normalized = {
          from: payload.from || "Unknown",
          text: payload.text || "",
          id: Date.now(),
        };
        setChatMessages((prev) =>
          Array.isArray(prev) ? [...prev, normalized] : [normalized]
        );

        setTimeout(() => {
          const el = document.querySelector(
            `[data-chat-id="${normalized.id}"]`
          );
          if (el) {
            el.classList.remove("translate-x-0", "opacity-0");
            el.classList.add("translate-x-42", "opacity-100");
          }
        }, 50);
        setTimeout(() => {
          const el = document.querySelector(
            `[data-chat-id="${normalized.id}"]`
          );
          if (el) {
            el.classList.remove("translate-x-42", "opacity-100");
            el.classList.add("translate-x-0", "opacity-0");
          }
          setTimeout(() => {
            setChatMessages((prev) =>
              Array.isArray(prev)
                ? prev.filter((m) => m.id !== normalized.id)
                : []
            );
          }, 1000);
        }, 5000);
        return;
      }

      if (msg.type === "all-positions") {
        const positions = msg.payload?.positions || {};
        setPlayerPositions(positions);
        return;
      }

      if (msg.type === "player-move") {
        const { name, r, c, dir } = msg.payload;
        setPlayerPositions((prev) => ({
          ...prev,
          [name]: { r, c, dir },
        }));
        return;
      }

      if (msg.type === "bomb-placed") {
        return;
      }

      if (msg.type === "bomb-explode") {
        const { r, c, range = 1, explosionCells } = msg.payload || {};
        if (typeof r === "number" && typeof c === "number") {
          handleBombExplode(r, c, range, explosionCells);

          const now = Date.now();
          if (now >= iFrameUntil) {
            const rc = getSelfRCNow();
            const cells =
              Array.isArray(explosionCells) && explosionCells.length
                ? explosionCells
                : [];

            if (
              rc &&
              cells.some((cell) => cell.r === rc.r && cell.c === rc.c)
            ) {
              setIFrameUntil(now + 700);

              const ws2 = getSharedSocket();
              if (ws2 && ws2.readyState === WebSocket.OPEN) {
                ws2.send(
                  JSON.stringify({
                    type: "lose-life",
                    payload: { reason: "explosion", at: { r, c } },
                  })
                );
              }
            }
          }
        }
        return;
      }

      if (msg.type === "lives-bulk") {
        const pack = Array.isArray(msg.payload) ? msg.payload : [];
        const next = {};
        pack.forEach((p) => {
          next[p.id] = p.lives;
        });
        setLivesMap(next);
        return;
      }

      if (msg.type === "lives-update") {
        const { id, lives } = msg.payload || {};
        if (typeof id === "number" || typeof id === "string") {
          setLives(id, lives);
        }
        return;
      }

      if (msg.type === "player-dead") {
        const deadId = msg.payload?.id;
        const deadName = msg.payload?.name;

        setLives(deadId, 0);

        const self = resolveSelfFromPlayers(players);
        if (self && self.id === deadId) {
          showError("💀 You have died! Spectating other players...");
          setPlayers((prev) =>
            prev.map((p) =>
              p.id === deadId ? { ...p, dead: true, isSpectator: true } : p
            )
          );
        } else {
          setPlayers((prev) =>
            prev.map((p) =>
              p.id === deadId ? { ...p, dead: true, isSpectator: true } : p
            )
          );
        }
        return;
      }

      if (msg.type === "game-over") {
        setGameOver(msg.payload.winner||{name:"Unknown"});
        try {
          const a = gameMusicRef.current;
          if (a) {
            a.pause();
            a.currentTime = 0;
          }
        } catch {}
        window.location.href = "/gameover";
        return;
      }

      rtc?.handleSignalMessage?.(msg);
    };

    const onOpen = () => {
      try {
        ws.send(JSON.stringify({ type: "game-state", payload: { text: "" } }));
        ws.send(JSON.stringify({ type: "request-players" }));
        ws.send(JSON.stringify({ type: "request-map" }));
        ws.send(JSON.stringify({ type: "request-positions" }));
        ws.send(JSON.stringify({ type: "request-lives" }));
      } catch {}
    };

    const onClose = () => {
      showError("Connection lost — returning to lobby.");
      window.location.href = "/";
    };

    ws.addEventListener("message", onMessage);
    ws.addEventListener("open", onOpen);
    ws.addEventListener("close", onClose);

    if (ws.readyState === WebSocket.OPEN) Promise.resolve().then(onOpen);

    rtc?.setMicState?.(false);

    return () => {
      rtc?.cleanup?.();
      try {
        ws.removeEventListener("message", onMessage);
      } catch {}
      try {
        ws.removeEventListener("open", onOpen);
      } catch {}
      try {
        ws.removeEventListener("close", onClose);
      } catch {}
    };
  }, []);

  /* ---------- misc effects ---------- */

  useEffect(() => {
    const chatBox = document.getElementById("chat-box");
    if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
  }, [chatMessages]);

  useEffect(() => {
    setShowQuickChat(false);
    setShowAudioPanel(false);
    setShowSoundPanel(false);
    setQuickText("");
    rtc?.setMicState?.(false);
  }, []);

  useEffect(() => {
    if (showQuickChat) {
      setShowAudioPanel(false);
      setShowSoundPanel(false);
      rtc?.setMicState?.(false);
    } else {
      setQuickText("");
    }
  }, [showQuickChat]);

  useEffect(() => {
    rtc?.syncMuteStatesToAudios?.(players, mutedMap);
  }, [mutedMap, players]);

  useEffect(() => {
    function onKey(e) {
      const k = e.key?.toLowerCase();
      const typing = isTypingTarget(e.target);

      if (showQuickChat || typing) return;
      
      if (k === " " || k === "b") {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById("bomb-button")?.click();
      }
      
      // Sound panel shortcut (Alt+S)
      if (e.altKey && k === 's') {
        e.preventDefault();
        e.stopPropagation();
        toggleSoundPanel();
      }
    }

    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [showQuickChat, showSoundPanel]);

  useEffect(() => {
    if (bombExplosions.length > 0) {
      const timer = setTimeout(() => {
        setBombExplosions([]);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [bombExplosions]);

  function setLives(id, lives) {
    let v = Number(lives);
    if (!Number.isFinite(v)) v = 3;
    v = Math.max(0, Math.min(3, v));

    setLivesMap((prev) => {
      const prevVal = prev && typeof prev === "object" ? prev[id] : undefined;
      const nextState = { ...prev, [id]: v };

      const selfId = readSelfId();
      if (
        selfId != null &&
        String(selfId) === String(id) &&
        typeof prevVal === "number" &&
        v < prevVal
      ) {
        playDamageSound();
      }

      return nextState;
    });
  }

  function getSelfRCNow() {
    const self = resolveSelfFromPlayers(players);
    if (self && typeof self.r === "number" && typeof self.c === "number")
      return { r: self.r, c: self.c };
    const saved = readSelfRC();
    return saved || null;
  }

  useEffect(() => {
    const handleBackButton = (event) => {
      window.history.pushState(null, null, window.location.href);
    };

    window.history.pushState(null, null, window.location.href);
    window.addEventListener('popstate', handleBackButton);

    return () => {
      window.removeEventListener('popstate', handleBackButton);
    };
  }, []);

  return h(
    "div",
    {
      class:
        "min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden",
      style: `
        background-image: url('/assets/Sky.png');
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        background-attachment: fixed;
      `,
    },
    h("audio", {
      src: "/audio/GameSound.mp3",
      ref: gameMusicRef,
      autoplay: true,
      loop: true,
      id: "game-music-audio"
    }),
    
    useErrorPopup(),
    h(
      "div",
      {
        class: "flex flex-col items-center flex-1 py-4",
      },
      MapGrid({
        gameMap,
        children: h(
          "div",
          null,
          Bombs({
            gameMap,
            players,
            bombs,
            setBombs,
            playerPowerups,
            disableHotkey: showQuickChat,
            renderLayer: true,
            renderButton: false,
            onBombExplode: handleBombExplode,
            onPlaceBomb: playPlaceBombSound,
          }),
          PowerupsUI({ gameMap }),
          Array.isArray(gameMap) && gameMap.length > 0
            ? Explosions({
                gameMap,
                setGameMap,
                bombExplosions,
              })
            : null,
          PlayerSprites({
            gameMap,
            players,
            selfName: myName(),
            playerPositions,
          }),
          (() => {
            const self = resolveSelfFromPlayers(players);
            if (!self || self.dead || self.isSpectator) return null;
            return self ? MyPlayer({ gameMap, players, self }) : null;
          })()
        ),
      }),
      PowerUpsSection({
        playerPowerups,
        selfName: myName(),
        key: `powerups-${myName()}`,
      })
    ),
    Bombs({
      gameMap,
      players,
      bombs,
      setBombs,
      playerPowerups,
      disableHotkey: showQuickChat,
      renderLayer: false,
      renderButton: true,
      onPlaceBomb: playPlaceBombSound,
    }),
    RightRail({
      toggleQuickChat,
      toggleAudioPanel,
      micOn,
      onMicToggle: async () => {
        const next = !micOn;
        await rtc?.setMicState?.(next);
      },
    }),
    showQuickChat
      ? QuickChatPopover({
          quickText,
          setQuickText,
          onSend: sendQuickChat,
          onClose: closeQuickChat,
        })
      : null,
    showAudioPanel
      ? AudioPanel({
          players,
          mutedMap,
          toggleMuted,
          selfName: myName(),
        })
      : null,
    showInfo
      ? InfoOverlay({
          open: showInfo,
          onClose: () => setShowInfo(false),
          playerCharacter: getPlayerCharacter()
        })
      : null,
    showSoundPanel
      ? SoundPanel({
          open: showSoundPanel,
          onClose: () => setShowSoundPanel(false),
          onVolumeChange: updateAudioVolumes
        })
      : null,
    h(
      "button",
      {
        "aria-label": "Sound settings",
        onclick: toggleSoundPanel,
        class: `
          fixed right-32 top-5 z-[999]
          w-12 h-12 rounded-full flex items-center justify-center
          cursor-pointer bg-black/50 border border-white/30 backdrop-blur
          shadow-[0_6px_15px_rgba(0,0,0,.4)]
          hover:scale-105 active:scale-95 transition-transform
          focus:outline-none focus:ring-2 focus:ring-yellow-300/60
          group
        `,
      },
      h(
        "span",
        { 
          class: "text-2xl text-yellow-300 group-hover:scale-110 transition-transform",
          style: "filter: drop-shadow(0 2px 2px rgba(0,0,0,0.5));"
        },
        "🔊"
      )
    ),
    h(
      "button",
      {
        "aria-label": "Game info",
        onclick: () => setShowInfo(true),
        class: `
          fixed right-20 top-5 z-[999]
          w-12 h-12 rounded-full flex items-center justify-center
          cursor-pointer bg-black/50 border border-white/30 backdrop-blur
          shadow-[0_6px_15px_rgba(0,0,0,.4)]
          hover:scale-105 active:scale-95 transition-transform
          focus:outline-none focus:ring-2 focus:ring-yellow-300/60
        `,
      },
      h(
        "span",
        { class: "text-lg text-white font-semibold select-none tracking-wide" },
        "i"
      )
    ),
    h(
      "button",
      {
        class: `
          fixed right-6 top-5 z-[999] text-red-500
          w-12 h-12 rounded-full flex items-center justify-center
          cursor-pointer bg-black/50 border border-white/30 backdrop-blur
          shadow-[0_6px_15px_rgba(0,0,0,.4)]
          hover:scale-105 active:scale-95 transition-transform
          focus:outline-none focus:ring-2 focus:ring-yellow-300/60
        `,
        onclick: () => {
          window.location.href = "/";
        },
      },
      "X"
    ),
    LeftHud({ players, chatMessages, livesMap })
  );
}