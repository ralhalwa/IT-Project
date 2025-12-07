import { h } from "../../framework/dom.js";
import { useState, useEffect } from "../../framework/hooks.js";
import { POWERUPS } from "../Methods/PowersUps.js";

// Tailwind-safe color mapping per powerup type
const COLOR_CLASS = {
  bomb: "bg-sky-400",
  flame: "bg-orange-500",
  speed: "bg-yellow-400",
};

export default function PowerUpsSection({ playerPowerups, selfName }) {
  function normalizeName(name) {
    let cleaned = String(name || "").trim();
    // Remove surrounding quotes if they exist
    if (
      (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))
    ) {
      cleaned = cleaned.slice(1, -1);
    }
    return cleaned; // keep original case to match Game.js keys
  }

  selfName = normalizeName(selfName);

  // 🔁 Force re-render every second so bars update
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const currentPlayerPowerups = playerPowerups[selfName] || {};

  const powerupsFiltered = Object.entries(POWERUPS).filter(([type, data]) => 
       data.name !== "Extra Life"
    );  
    const powerups = powerupsFiltered.map(([type, data]) => {
    const activePowerups = currentPlayerPowerups[type] || [];

    const totalTimeRemaining = Array.isArray(activePowerups)
      ? Math.max(
          0,
          ...activePowerups.map((p) => Math.max(0, p.expiresAt - now)),
          0
        )
      : 0;

    return {
      type,
      color: data.color,
      icon: `/assets/PowerUps/${data.icon}`,
      timeRemaining: totalTimeRemaining,
      maxTime: 10000, // 10 seconds
    };
  });

  return h(
    "div",
    {
      class: "powerups-section flex flex-col items-center",
    },
    h(
      "div",
      {
        class: "flex gap-6",
      },
      ...powerups.map((p) => PowerUpBar({ ...p, key: `pu-${p.type}` }))
    )
  );
}

function PowerUpBar(powerup) {
  const progressPercentage = Math.min(
    (powerup.timeRemaining / powerup.maxTime) * 100,
    100
  );
  const bgClass = COLOR_CLASS[powerup.type] || "bg-gray-400";

  return h(
    "div",
    {
      class: "powerup-item flex items-center gap-3",
      key: powerup.key || `pu-${powerup.type}`,
    },
    // icon
    h(
      "div",
      {
        class: "icon-container",
      },
      h("img", {
        src: powerup.icon,
        class: "w-14 h-16 pixelated",
        alt: `${powerup.type} powerup`,
      })
    ),

    // progress bar only (no seconds text)
    h(
      "div",
      {
        class: "progress-container flex flex-col items-center",
      },
      h(
        "div",
        {
          class:
            "progress-background w-32 h-6 border-2 border-white bg-gray-800 pixel-border",
        },
        h("div", {
          class: `progress-fill h-full ${bgClass}`,
          style: `width: ${progressPercentage}%;`,
        })
      )
    )
  );
}
