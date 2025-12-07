import { h } from "../../framework/dom.js";
import { useState, useEffect } from "../../framework/hooks.js";

export default function ActivePowerupsIndicator({ playerPowerups, selfName }) {
  const [visible, setVisible] = useState(false);
  
  const myPowerups = (playerPowerups && typeof playerPowerups === 'object' && playerPowerups[selfName]) || {};
  const now = Date.now();
  
  const activeFlames = Array.isArray(myPowerups.flame) ? 
    myPowerups.flame.filter(p => p && p.expiresAt > now) : [];
   const activeSpeed = Array.isArray(myPowerups.speed) ? 
    myPowerups.speed.filter(p => p && p.expiresAt > now) : [];

     const getTimeRemaining = () => {
    // Check flame powerups first
    if (activeFlames.length > 0 && activeFlames[0] && activeFlames[0].expiresAt) {
      return Math.ceil((activeFlames[0].expiresAt - now) / 1000);
    }
    // Check speed powerups if no flames
    if (activeSpeed.length > 0 && activeSpeed[0] && activeSpeed[0].expiresAt) {
      return Math.ceil((activeSpeed[0].expiresAt - now) / 1000);
    }
    return 0;
  };
  
  const timeRemaining = getTimeRemaining();
  
  // Show indicator only when we have active powerups
  useEffect(() => {
    if (activeFlames.length > 0 || activeSpeed.length > 0) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [activeFlames.length, activeSpeed.length]);

  if (!visible || activeFlames.length === 0 && activeSpeed.length === 0) return null;
  
  return h(
    "div",
    {
      class: "fixed top-4 left-4 bg-black/70 text-white p-3 rounded-lg z-50 border-2 border-orange-500 shadow-lg"
    },
    h("div", { class: "flex items-center gap-3" },
      h("img", { 
        src: "/assets/PowerUps/Flame_PowerUp.png", 
        class: "w-8 h-8",
        style: "image-rendering: pixelated;"
      }),
      h("div", { class: "flex flex-col" },
        // Show appropriate message based on which powerups are active
        activeFlames.length > 0 && activeSpeed.length > 0 
          ? h("span", { class: "text-yellow-400 font-bold" }, `Flame +${activeFlames.length}, Speed Active`)
          : activeFlames.length > 0 
            ? h("span", { class: "text-yellow-400 font-bold" }, `Flame Power: +${activeFlames.length} Range`)
            : h("span", { class: "text-yellow-400 font-bold" }, `Speed Power: Active`),
        
        h("span", { class: "text-xs text-gray-300" }, 
          `Expires in ${timeRemaining}s`
        )
      )
    )
  );
}