// Robust, glare-safe WebRTC with candidate queueing and safe player lookup.

import { sendWS } from "./ws.js";
import { asArray } from "../utils/dom-helpers.js";

export function createRTC({
  peersRef,
  remoteAudiosRef,
  localStreamRef,
  selfIdRef,
  getPlayers,
  getMutedNameMap,
  getMicOn,
  setMicOn,
}) {
  async function ensureLocalStream() {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      const enabled = !!getMicOn();
      stream.getAudioTracks().forEach((t) => (t.enabled = enabled));
      localStreamRef.current = stream;
      return stream;
    } catch {
      const empty = new MediaStream();
      localStreamRef.current = empty;
      return empty;
    }
  }

  function isPcClosed(pc) {
    return (
      !pc ||
      pc.signalingState === "closed" ||
      pc.connectionState === "closed"
    );
  }

  async function attachLocalTrack(pc) {
    if (isPcClosed(pc)) return; // ✅ guard

    const stream = await ensureLocalStream();
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    if (isPcClosed(pc)) return; // ✅ guard again after await

    const sender = pc
      .getSenders()
      .find((s) => s.track && s.track.kind === "audio");

    if (sender) {
      if (sender.track !== track) {
        try {
          await sender.replaceTrack(track);
        } catch {}
      }
    } else {
      try {
        pc.addTrack(track, stream);
      } catch (err) {
        // If pc got closed between checks, ignore safely
        if (!isPcClosed(pc)) {
          console.warn("[webrtc] addTrack failed:", err?.message || err);
        }
      }
    }
  }

  function ensureRemoteAudioEl(remoteId) {
    if (!remoteAudiosRef.current) remoteAudiosRef.current = {};
    const got = remoteAudiosRef.current[remoteId];
    if (got) return got;

    const a = document.createElement("audio");
    a.autoplay = true;
    a.playsInline = true;
    a.dataset.peerId = String(remoteId);
    document.body.appendChild(a);

    remoteAudiosRef.current[remoteId] = a;
    return a;
  }

  function removeRemoteAudioEl(remoteId) {
    const a = remoteAudiosRef.current?.[remoteId];
    if (a) {
      try {
        a.pause();
      } catch {}
      try {
        a.remove();
      } catch {}
      delete remoteAudiosRef.current[remoteId];
    }
  }

  function amPoliteAgainst(remoteId) {
    try {
      const me = String(selfIdRef.current ?? "");
      const them = String(remoteId ?? "");
      return me.localeCompare(them) > 0;
    } catch {
      return true;
    }
  }

  function getOrCreatePeer(remoteId) {
    const peers = (peersRef.current ||= {});
    const existing = peers[remoteId];

    // ✅ If existing is closed, wipe it and re-create cleanly
    if (existing && isPcClosed(existing)) {
      try { existing.close(); } catch {}
      delete peers[remoteId];
    }

    if (peers[remoteId]) return peers[remoteId];

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    pc.__remoteId = remoteId;
    pc.__polite = amPoliteAgainst(remoteId);
    pc.__makingOffer = false;
    pc.__pendingCandidates = [];

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        sendWS({
          type: "rtc-ice",
          payload: { toId: remoteId, candidate: ev.candidate },
        });
      }
    };

    pc.ontrack = (ev) => {
      if (!ev.streams || !ev.streams[0]) return;
      const a = ensureRemoteAudioEl(remoteId);
      a.srcObject = ev.streams[0];

      try { a.play().catch(() => {}); } catch {}

      const list = asArray(getPlayers());
      const pl = list.find((p) => p && p.id === remoteId);
      const name = pl?.name || "";
      const muted = !!getMutedNameMap()?.[name];

      a.muted = muted;
      a.volume = muted ? 0 : 1;
    };

    pc.onconnectionstatechange = () => {
      if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
        try { pc.close(); } catch {}
        delete peersRef.current[remoteId];
        removeRemoteAudioEl(remoteId);
      }
    };

    pc.onnegotiationneeded = async () => {
      if (isPcClosed(pc)) return; // ✅ guard
      try {
        pc.__makingOffer = true;
        await attachLocalTrack(pc);
        if (isPcClosed(pc)) return; // ✅ guard after await

        const offer = await pc.createOffer();
        if (isPcClosed(pc)) return;

        await pc.setLocalDescription(offer);
        sendWS({
          type: "rtc-offer",
          payload: { toId: remoteId, sdp: pc.localDescription },
        });
      } catch (err) {
        console.warn("[webrtc] onnegotiationneeded error:", err?.message || err);
      } finally {
        pc.__makingOffer = false;
      }
    };

    peers[remoteId] = pc;
    return pc;
  }

  async function callPeer(peerId) {
    const pc = getOrCreatePeer(peerId);
    if (isPcClosed(pc)) return;
    await attachLocalTrack(pc);
  }

  function startVoiceMesh(currentPlayers) {
    asArray(currentPlayers)
      .filter((p) => p && p.id != null && p.id !== selfIdRef.current)
      .forEach((p) => {
        if (!peersRef.current?.[p.id]) getOrCreatePeer(p.id);
      });
  }

  async function setMicState(nextOn) {
    setMicOn(!!nextOn);
    const stream = await ensureLocalStream();
    const track = stream.getAudioTracks()[0];
    if (track) track.enabled = !!nextOn;

    await Promise.all(
      Object.values(peersRef.current || {}).map((pc) => attachLocalTrack(pc))
    );
  }

  function syncMuteStatesToAudios(players, mutedMap) {
    const audios = remoteAudiosRef.current || {};
    asArray(players).forEach((p) => {
      const a = audios[p.id];
      if (!a) return;
      const muted = !!mutedMap?.[p.name];
      a.muted = muted;
      a.volume = muted ? 0 : 1;
    });
  }

  async function handleSignalMessage(msg) {
    if (!msg || !msg.type) return;

    if (msg.type === "rtc-offer") {
      const fromId = msg.payload?.fromId;
      const offer = msg.payload?.sdp;
      if (!fromId || !offer) return;

      const pc = getOrCreatePeer(fromId);
      if (isPcClosed(pc)) return;

      const polite = pc.__polite;

      const readyForOffer =
        !pc.__makingOffer &&
        (pc.signalingState === "stable" ||
          (pc.signalingState === "have-local-offer" && polite));

      const offerCollision = !readyForOffer;

      try {
        if (offerCollision) {
          if (!polite) return;
          if (pc.signalingState !== "stable") {
            try { await pc.setLocalDescription({ type: "rollback" }); } catch {}
          }
        }

        await pc.setRemoteDescription(offer);

        if (pc.__pendingCandidates?.length) {
          for (const cand of pc.__pendingCandidates) {
            try { await pc.addIceCandidate(cand); } catch {}
          }
          pc.__pendingCandidates = [];
        }

        await attachLocalTrack(pc);

        if (pc.signalingState !== "have-remote-offer") return;

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        sendWS({
          type: "rtc-answer",
          payload: { toId: fromId, sdp: pc.localDescription },
        });
      } catch (err) {
        console.warn("[webrtc] handle offer error:", err?.message || err);
      }
      return;
    }

    if (msg.type === "rtc-answer") {
      const fromId = msg.payload?.fromId;
      const answer = msg.payload?.sdp;
      if (!fromId || !answer) return;

      const pc = getOrCreatePeer(fromId);
      if (isPcClosed(pc)) return;

      if (pc.signalingState !== "have-local-offer") return;

      try {
        await pc.setRemoteDescription(answer);

        if (pc.__pendingCandidates?.length) {
          for (const cand of pc.__pendingCandidates) {
            try { await pc.addIceCandidate(cand); } catch {}
          }
          pc.__pendingCandidates = [];
        }
      } catch {}
      return;
    }

    if (msg.type === "rtc-ice") {
      const fromId = msg.payload?.fromId;
      const candidate = msg.payload?.candidate;
      if (!fromId || !candidate) return;

      const pc = getOrCreatePeer(fromId);
      if (isPcClosed(pc)) return;

      if (!pc.remoteDescription || !pc.remoteDescription.type) {
        (pc.__pendingCandidates ||= []).push(candidate);
        return;
      }

      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.warn("[webrtc] addIceCandidate error:", err?.message || err);
      }
      return;
    }
  }

  function cleanup() {
    try {
      Object.values(peersRef.current || {}).forEach((pc) => {
        try { pc.close(); } catch {}
      });
      peersRef.current = {};
    } catch {}

    try {
      Object.values(remoteAudiosRef.current || {}).forEach((a) => {
        try { a.pause(); } catch {}
        try { a.remove(); } catch {}
      });
      remoteAudiosRef.current = {};
    } catch {}
  }

  return {
    setMicState,
    startVoiceMesh,
    callPeer,
    handleSignalMessage,
    syncMuteStatesToAudios,
    cleanup,
  };
}
