// VideoPanel.js - FIXED for video streaming
import { h } from "../../framework/dom.js";
import { useState, useEffect } from "../../framework/hooks.js";

export default function VideoPanel({
  players,
  mutedMap,
  toggleMuted,
  selfName,
  remoteVideosRef,
  localStreamRef,
  micOn,
  camOn,
  onToggleMic,
  onToggleCam,
}) {
  const [, forceUpdate] = useState(0);

  // Listen for stream updates
  useEffect(() => {
    const handler = () => {
      console.log("🔄 Stream updated, forcing re-render");
      forceUpdate(n => n + 1);
    };
    
    window.addEventListener('remote-stream-updated', handler);
    return () => window.removeEventListener('remote-stream-updated', handler);
  }, []);

  // Safe filtering
  const remotePlayers = Array.isArray(players) 
    ? players.filter(p => p && p.name !== selfName && !p.dead && !p.isSpectator)
    : [];

  return h(
    "div",
    {
      class: `
        fixed right-4 top-20 bottom-4
        w-80 flex flex-col gap-3
        bg-black/80 backdrop-blur-md
        border-2 border-white/20 rounded-2xl
        p-4 z-[997]
        shadow-[0_10px_40px_rgba(0,0,0,0.6)]
        overflow-y-auto
      `,
    },
    h(
      "div",
      {
        class: "text-white font-bold text-lg mb-2 flex items-center justify-between",
      },
      h("span", {}, "Video Chat"),
      h(
        "span",
        { class: "text-sm text-white/60 font-normal" },
        `${remotePlayers.length + 1} online`
      )
    ),

    // Local video
    h(
      "div",
      {
        class: `
          relative bg-gray-900 rounded-xl overflow-hidden
          border-2 border-yellow-400/50
          aspect-video
        `,
      },
      localStreamRef.current && camOn 
        ? h("video", {
            srcObject: localStreamRef.current,
            autoplay: true,
            playsInline: true,
            muted: true,
            class: "w-full h-full object-cover",
          })
        : h(
            "div",
            {
              class: "w-full h-full flex items-center justify-center bg-gray-800",
            },
            h(
              "div",
              { class: "text-center" },
              h("div", { class: "text-6xl mb-2" }, "🎮"),
              h("div", { class: "text-white/60 text-sm" }, selfName || "You")
            )
          ),
      h(
        "div",
        {
          class: `
            absolute bottom-2 left-2 right-2
            bg-black/70 backdrop-blur-sm
            px-3 py-1.5 rounded-lg
            flex items-center justify-between
          `,
        },
        h(
          "span",
          { class: "text-white font-semibold text-sm truncate" },
          `${selfName || "You"} (You)`
        ),
        h(
          "div",
          { class: "flex gap-2" },
          h(
            "button",
            {
              class: `
                w-8 h-8 rounded-full flex items-center justify-center
                ${micOn ? 'bg-green-500/20' : 'bg-red-500/20'}
                border ${micOn ? 'border-green-400' : 'border-red-400'}
                hover:scale-110 transition-transform
              `,
              onclick: onToggleMic,
            },
            h("span", { class: "text-sm" }, micOn ? "🎤" : "🔇")
          ),
          h(
            "button",
            {
              class: `
                w-8 h-8 rounded-full flex items-center justify-center
                ${camOn ? 'bg-green-500/20' : 'bg-red-500/20'}
                border ${camOn ? 'border-green-400' : 'border-red-400'}
                hover:scale-110 transition-transform
              `,
              onclick: onToggleCam,
            },
            h("span", { class: "text-sm" }, camOn ? "📹" : "📵")
          )
        )
      )
    ),

    h("div", { class: "h-px bg-white/10 my-2" }),

    // Remote players
    h(
      "div",
      { class: "flex flex-col gap-3" },
      ...(remotePlayers.length === 0
        ? [h(
            "div",
            {
              class: "text-white/40 text-center py-8 text-sm",
            },
            "No other players online"
          )]
        : remotePlayers.map((player) => {
            if (!player || !player.id) return null;
            
            const isMuted = !!(mutedMap && mutedMap[player.name]);
            const videoEl = remoteVideosRef.current?.[player.id];
            const hasStream = videoEl?.srcObject;
            const hasVideoTrack = hasStream?.getVideoTracks().length > 0;
            
            console.log(`Player ${player.name}: hasStream=${!!hasStream}, hasVideo=${hasVideoTrack}`);
            
            return h(
              "div",
              {
                key: player.id,
                class: `
                  relative bg-gray-900 rounded-xl overflow-hidden
                  border-2 border-white/20
                  aspect-video
                  hover:border-white/40 transition-colors
                `,
              },
              hasStream && hasVideoTrack
                ? h("video", {
                    srcObject: videoEl.srcObject,
                    autoplay: true,
                    playsInline: true,
                    muted: isMuted,
                    class: "w-full h-full object-cover",
                  })
                : h(
                    "div",
                    {
                      class: "w-full h-full flex items-center justify-center bg-gray-800",
                    },
                    h(
                      "div",
                      { class: "text-center" },
                      h("div", { class: "text-5xl mb-2" }, hasStream && !hasVideoTrack ? "🎤" : "🎮"),
                      h("div", { class: "text-white/60 text-sm" }, player.name || "Unknown"),
                      hasStream && !hasVideoTrack 
                        ? h("div", { class: "text-xs text-white/40 mt-1" }, "Audio only")
                        : null
                    )
                  ),
              h(
                "div",
                {
                  class: `
                    absolute bottom-2 left-2 right-2
                    bg-black/70 backdrop-blur-sm
                    px-3 py-1.5 rounded-lg
                    flex items-center justify-between
                  `,
                },
                h(
                  "span",
                  { class: "text-white font-semibold text-sm truncate" },
                  player.name || "Unknown"
                ),
                h(
                  "button",
                  {
                    class: `
                      w-8 h-8 rounded-full flex items-center justify-center
                      ${isMuted ? 'bg-red-500/20 border-red-400' : 'bg-green-500/20 border-green-400'}
                      border hover:scale-110 transition-transform
                    `,
                    onclick: () => toggleMuted && toggleMuted(player.name),
                  },
                  h("span", { class: "text-sm" }, isMuted ? "🔇" : "🔊")
                )
              )
            );
          }))
    )
  );
}