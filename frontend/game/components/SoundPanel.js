import { h } from "../../framework/dom.js";
import { useState, useEffect } from "../../framework/hooks.js";

export default function SoundPanel({ open, onClose, onVolumeChange }) {
  if (!open) return null;

  // Get current volume from localStorage or default
  const getVolume = (key, defaultValue = 0.5) => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        const vol = parseFloat(saved);
        return isNaN(vol) || !isFinite(vol) ? defaultValue : Math.min(1, Math.max(0, vol));
      }
    } catch {}
    return defaultValue;
  };

  const [gameMusicVol, setGameMusicVol] = useState(() => getVolume('bm_gameMusic_vol', 0.3));
  const [soundEffectsVol, setSoundEffectsVol] = useState(() => getVolume('bm_sfx_vol', 0.7));
  const [voiceChatVol, setVoiceChatVol] = useState(() => getVolume('bm_voice_vol', 0.8));
  const [isMuted, setIsMuted] = useState(() => {
    try {
      const savedSfx = localStorage.getItem('bm_sfx_vol');
      if (savedSfx) {
        const vol = parseFloat(savedSfx);
        return vol === 0;
      }
    } catch {}
    return false;
  });

  // Handle mute toggle
  const toggleMute = () => {
    if (isMuted) {
      // Unmute - restore previous volume or default
      const prevVolume = getVolume('bm_sfx_prev', 0.7);
      setSoundEffectsVol(prevVolume);
      setIsMuted(false);
    } else {
      // Mute - save current volume and set to 0
      try {
        localStorage.setItem('bm_sfx_prev', soundEffectsVol.toString());
      } catch {}
      setSoundEffectsVol(0);
      setIsMuted(true);
    }
  };

  useEffect(() => {
    // Update mute state when sound effects volume changes
    setIsMuted(soundEffectsVol === 0);
    
    // Save volumes to localStorage with validation
    try {
      const musicVol = isFinite(gameMusicVol) ? Math.max(0, Math.min(1, gameMusicVol)) : 0.3;
      const sfxVol = isFinite(soundEffectsVol) ? Math.max(0, Math.min(1, soundEffectsVol)) : 0.7;
      const voiceVol = isFinite(voiceChatVol) ? Math.max(0, Math.min(1, voiceChatVol)) : 0.8;
      
      localStorage.setItem('bm_gameMusic_vol', musicVol.toString());
      localStorage.setItem('bm_sfx_vol', sfxVol.toString());
      localStorage.setItem('bm_voice_vol', voiceVol.toString());
      
      // Save previous volume if not muted
      if (sfxVol > 0) {
        localStorage.setItem('bm_sfx_prev', sfxVol.toString());
      }
    } catch {}
    
    if (onVolumeChange) {
      onVolumeChange({
        gameMusic: gameMusicVol,
        soundEffects: soundEffectsVol,
        voiceChat: voiceChatVol
      });
    }
  }, [gameMusicVol, soundEffectsVol, voiceChatVol]);

  // Control all audio elements on page
  useEffect(() => {
    // Ensure volume values are valid
    const safeMusicVol = isFinite(gameMusicVol) ? Math.max(0, Math.min(1, gameMusicVol)) : 0.3;
    const safeSfxVol = isFinite(soundEffectsVol) ? Math.max(0, Math.min(1, soundEffectsVol)) : 0.7;
    const safeVoiceVol = isFinite(voiceChatVol) ? Math.max(0, Math.min(1, voiceChatVol)) : 0.8;

    // Update game music
    const gameMusic = document.querySelector('#game-music-audio');
    if (gameMusic) {
      gameMusic.volume = safeMusicVol;
    }

    // Update all SFX audio elements
    document.querySelectorAll('audio:not(#game-music-audio)').forEach(audio => {
      if (!audio.id.includes('voice')) {
        audio.volume = safeSfxVol;
      }
    });

    // Update voice chat audio
    document.querySelectorAll('audio[id*="voice"]').forEach(audio => {
      audio.volume = safeVoiceVol;
    });
  }, [gameMusicVol, soundEffectsVol, voiceChatVol]);

  const VolumeSlider = ({ label, value, onChange, icon, isMuted = false, onMuteToggle }) => {
    const safeValue = isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
    
    return h(
      "div",
      { class: "flex items-center gap-4 py-3 border-b border-white/10" },
      h(
        "div",
        { class: "flex items-center gap-3 w-32" },
        icon === "💥" ? (
          h(
            "button",
            {
              onclick: onMuteToggle,
              class: `
                w-8 h-8 flex items-center justify-center rounded
                hover:bg-yellow-600/20 active:scale-95 transition-all
                focus:outline-none focus:ring-1 focus:ring-yellow-400
              `,
              title: isMuted ? "Unmute sound effects" : "Mute sound effects"
            },
            h("span", { 
              class: `text-xl ${isMuted ? "text-gray-400" : "text-yellow-300"}`
            }, isMuted ? "🔇" : icon)
          )
        ) : h("span", { 
          class: "text-white text-lg w-8 h-8 flex items-center justify-center" 
        }, icon),
        h("span", { class: "text-white font-medium text-sm" }, label)
      ),
      h("div", { class: "flex-1 flex items-center gap-3" },
        h("input", {
          type: "range",
          min: "0",
          max: "1",
          step: "0.01",
          value: safeValue,
          oninput: (e) => {
            const val = parseFloat(e.target.value);
            if (isFinite(val)) {
              const newVal = Math.max(0, Math.min(1, val));
              onChange(newVal);
              // If we're adjusting the slider and it was muted, unmute it
              if (icon === "💥" && isMuted && newVal > 0) {
                setIsMuted(false);
              }
            }
          },
          class: `
            flex-1 h-2 bg-gradient-to-r from-yellow-900/30 to-yellow-500/50
            rounded-full appearance-none cursor-pointer
            ${isMuted ? "opacity-50" : ""}
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-gradient-to-br
            [&::-webkit-slider-thumb]:from-yellow-300 [&::-webkit-slider-thumb]:to-yellow-600
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-yellow-700
            [&::-webkit-slider-thumb]:shadow-lg
            [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-gradient-to-br
            [&::-moz-range-thumb]:from-yellow-300 [&::-moz-range-thumb]:to-yellow-600
            [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-yellow-700
            hover:[&::-webkit-slider-thumb]:scale-110
            transition-all duration-200
          `
        }),
        h("span", { 
          class: `font-bold w-10 text-center text-sm ${isMuted ? "text-gray-400" : "text-yellow-300"}`
        }, isMuted ? "MUTED" : `${Math.round(safeValue * 100)}%`)
      )
    );
  };

  // Preset functions that handle mute state
  const applyQuietPreset = () => {
    setGameMusicVol(0.1);
    setSoundEffectsVol(0.1);
    setVoiceChatVol(0.1);
    setIsMuted(false); // Quiet but not muted
  };

  const applyDefaultPreset = () => {
    setGameMusicVol(0.3);
    setSoundEffectsVol(0.7);
    setVoiceChatVol(0.8);
    setIsMuted(false); // Definitely not muted
  };

  const applyLoudPreset = () => {
    setGameMusicVol(1.0);
    setSoundEffectsVol(1.0);
    setVoiceChatVol(1.0);
    setIsMuted(false); // Definitely not muted
  };

  // Test sound that respects mute
  const playTestSound = () => {
    if (isMuted || soundEffectsVol === 0) {
      return; // Don't play if muted
    }
    const testSound = new Audio("/audio/01-power-up-mario.mp3");
    testSound.volume = isFinite(soundEffectsVol) ? soundEffectsVol : 0.7;
    testSound.play().catch(() => {});
  };

  return h(
    "div",
    { 
      class: "fixed inset-0 z-[1000] flex items-center justify-center",
      style: "background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(4px);"
    },
    h(
      "div",
      {
        class: `
          relative w-full max-w-md mx-4
          bg-gradient-to-br from-gray-900/95 to-gray-800/95
          border-2 border-yellow-600/50 rounded-2xl
          shadow-[0_20px_60px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]
          backdrop-blur-xl
          overflow-hidden
        `
      },
      // Decorative top bar
      h("div", { 
        class: "h-2 bg-gradient-to-r from-yellow-400 via-red-500 to-yellow-400"
      }),
      
      // Header
      h(
        "div",
        { class: "p-6 pb-4" },
        h(
          "div",
          { class: "flex items-center justify-between mb-6" },
          h(
            "div",
            { class: "flex items-center gap-3" },
            h(
              "span",
              { 
                class: "text-yellow-400 text-3xl",
                style: "text-shadow: 0 2px 4px rgba(0,0,0,0.5);"
              },
              "🔊"
            ),
            h(
              "h2",
              { 
                class: "text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500"
              },
              "Sound Settings"
            )
          ),
          h(
            "button",
            {
              onclick: onClose,
              class: `
                w-10 h-10 rounded-full flex items-center justify-center
                bg-gray-800/80 border border-yellow-600/30
                hover:bg-gray-700/80 hover:border-yellow-500/50
                active:scale-95 transition-all duration-200
                group
              `
            },
            h("span", { 
              class: "text-yellow-400 text-xl group-hover:scale-110 transition-transform"
            }, "✕")
          )
        ),
        
        // Volume controls
        h(
          "div",
          { class: "space-y-1" },
          VolumeSlider({
            label: "Game Music",
            value: gameMusicVol,
            onChange: setGameMusicVol,
            icon: "🎵"
          }),
          VolumeSlider({
            label: "Sound Effects",
            value: soundEffectsVol,
            onChange: setSoundEffectsVol,
            icon: "💥",
            isMuted: isMuted,
            onMuteToggle: toggleMute
          }),
          VolumeSlider({
            label: "Voice Chat",
            value: voiceChatVol,
            onChange: setVoiceChatVol,
            icon: "🎤"
          })
        ),
        
        // Quick mute button for all sounds
        h(
          "button",
          {
            onclick: () => {
              if (soundEffectsVol === 0 && gameMusicVol === 0 && voiceChatVol === 0) {
                // If all are muted, unmute to defaults
                setGameMusicVol(0.3);
                setSoundEffectsVol(0.7);
                setVoiceChatVol(0.8);
                setIsMuted(false);
              } else {
                // Mute all
                setGameMusicVol(0);
                setSoundEffectsVol(0);
                setVoiceChatVol(0);
                setIsMuted(true);
              }
            },
            class: `
              w-full mt-4 py-3 px-4 rounded-xl
              bg-gradient-to-r ${soundEffectsVol === 0 && gameMusicVol === 0 && voiceChatVol === 0 
                ? "from-green-600/70 to-green-800/70" 
                : "from-red-600/70 to-red-800/70"}
              border ${soundEffectsVol === 0 && gameMusicVol === 0 && voiceChatVol === 0 
                ? "border-green-500/50" 
                : "border-red-500/50"}
              hover:${soundEffectsVol === 0 && gameMusicVol === 0 && voiceChatVol === 0 
                ? "from-green-500/70 hover:to-green-700/70 hover:border-green-400/50" 
                : "from-red-500/70 hover:to-red-700/70 hover:border-red-400/50"}
              active:scale-95 transition-all duration-200
              flex items-center justify-center gap-3
            `
          },
          h("span", { 
            class: "text-white text-xl" 
          }, soundEffectsVol === 0 && gameMusicVol === 0 && voiceChatVol === 0 ? "🔊" : "🔇"),
          h("span", { 
            class: "text-white font-bold text-sm" 
          }, soundEffectsVol === 0 && gameMusicVol === 0 && voiceChatVol === 0 ? "UNMUTE ALL" : "MUTE ALL")
        ),
        
        // Preset buttons
        h(
          "div",
          { class: "flex gap-3 mt-4" },
          h(
            "button",
            {
              onclick: applyQuietPreset,
              class: `
                flex-1 py-3 px-4 rounded-xl
                bg-gradient-to-br from-gray-800 to-gray-900
                border border-gray-700
                hover:border-yellow-600/50 hover:from-gray-700 hover:to-gray-800
                active:scale-95 transition-all duration-200
                group
              `
            },
            h("div", { class: "text-center" },
              h("div", { class: "text-yellow-400 text-lg group-hover:scale-110 transition-transform" }, "🔈"),
              h("div", { class: "text-gray-300 text-xs font-medium mt-1" }, "Quiet")
            )
          ),
          h(
            "button",
            {
              onclick: applyDefaultPreset,
              class: `
                flex-1 py-3 px-4 rounded-xl
                bg-gradient-to-br from-yellow-900/30 to-yellow-800/20
                border border-yellow-600/30
                hover:border-yellow-500/50 hover:from-yellow-800/40 hover:to-yellow-700/30
                active:scale-95 transition-all duration-200
                group
              `
            },
            h("div", { class: "text-center" },
              h("div", { class: "text-yellow-300 text-lg group-hover:scale-110 transition-transform" }, "🔉"),
              h("div", { class: "text-yellow-200 text-xs font-medium mt-1" }, "Default")
            )
          ),
          h(
            "button",
            {
              onclick: applyLoudPreset,
              class: `
                flex-1 py-3 px-4 rounded-xl
                bg-gradient-to-br from-red-900/30 to-red-800/20
                border border-red-600/30
                hover:border-red-500/50 hover:from-red-800/40 hover:to-red-700/30
                active:scale-95 transition-all duration-200
                group
              `
            },
            h("div", { class: "text-center" },
              h("div", { class: "text-red-300 text-lg group-hover:scale-110 transition-transform" }, "🔊"),
              h("div", { class: "text-red-200 text-xs font-medium mt-1" }, "Loud")
            )
          )
        ),
        
        // Test sound button
        h(
          "button",
          {
            onclick: playTestSound,
            disabled: isMuted || soundEffectsVol === 0,
            class: `
              w-full mt-4 py-3 px-4 rounded-xl
              bg-gradient-to-r from-blue-600/70 to-purple-600/70
              border border-blue-500/50
              hover:from-blue-500/70 hover:to-purple-500/70
              hover:border-blue-400/50
              active:scale-95 transition-all duration-200
              flex items-center justify-center gap-3
              ${(isMuted || soundEffectsVol === 0) ? "opacity-50 cursor-not-allowed" : ""}
            `
          },
          h("span", { 
            class: "text-white text-lg" 
          }, "▶️"),
          h("span", { 
            class: "text-white font-bold text-sm" 
          }, (isMuted || soundEffectsVol === 0) ? "SOUND MUTED" : "Test Sound")
        )
      ),
      
      // Bottom decorative border
      h("div", { 
        class: "h-1 bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent mt-2"
      })
    )
  );
}