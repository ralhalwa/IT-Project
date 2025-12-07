export const POWERUPS = {
    bomb: {
        id: 1,
        name: "Extra Bomb",
        color: "lightblue",
        probability: 0.25,
        icon: "Bomb_PowerUp.png",
        description: "Drop +1 bomb at a time",
        time: "10",
        effect: "bombCount",
        value: 1,
        maxStacks: 2
    },
    flame: {
        id: 2,
        name: "Fire Flower",
        color: "orange",
        probability: 0.5,
        icon: "Flame_PowerUp.png",
        description: "+1 explosion range",
        time: "10",
        effect: "bombRange", 
        value: 1,
        maxStacks: 2
    },
    speed: {
        id: 3,
        name: "Super Mushroom",
        color: "yellow",
        probability: 0.25,
        icon: "Speed_PowerUp.png",
        description: "Move faster",
        time: "10",
        effect: "speed",
        value: 0.5,
        maxStacks: 2
    },
    life: {
        id: 4,
        name: "Extra Life",
        color: "green",
        probability: 0.25,
        icon: "Life_PowerUp3.png",
        description: "+1 life",
        time: "10",
        effect: "life",
        value: 1,
        maxStacks: 1
    },
}

export const playerPowerups = new Map();

export function getRandomPowerupType(){
    const random = Math.random();
    let cumulative = 0;

    for (const [type, powerup] of Object.entries(POWERUPS)){
        cumulative += powerup.probability;
        if (random <= cumulative){
            return type;
        }
    }

    return 'bomb';
}

// Calculate total effect value based on count of powerup
export function calculatePowerupEffect(powerupType, count) {
  const powerup = POWERUPS[powerupType];
  if (!powerup) return 0;
  
  const effectiveCount = Math.min(count, powerup.maxStacks);
  return powerup.value * effectiveCount;
}

// Apply powerup effect to player
export function applyPowerupEffect(playerId, powerupType) {
  if (!playerPowerups.has(playerId)) {
    playerPowerups.set(playerId, { 
      bomb: 0, 
      flame: 0, 
      speed: 0, 
      life: 0,
      flameExpiresAt: null
    });
  }

  const playerPowers = playerPowerups.get(playerId);
  
  switch(powerupType) {
    case 'flame':
      const flameCount = (playerPowers.flame || 0) + 1;
      playerPowers.flame = flameCount;
      
      playerPowers.flameExpiresAt = Date.now() + 10000; // 10 seconds
      
      break;
      
    case 'bomb':
      playerPowers.bomb = (playerPowers.bomb || 0) + 1;
      break;
      
    case 'speed':
      playerPowers.speed = (playerPowers.speed || 0) + 1;
      break;
      
    case 'life':
      playerPowers.life = (playerPowers.life || 0) + 1;
      break;
  }
  
  return playerPowers[powerupType];
}

// Calculate current bomb range including flame powerups
export function getPlayerBombRange(playerId) {
  const baseRange = 1;
  
  if (!playerPowerups.has(playerId)) {
    return baseRange;
  }
  
  const playerPowers = playerPowerups.get(playerId);
  const now = Date.now();
  
  // Check if flame powerup is active and not expired
  if (playerPowers.flame > 0 && playerPowers.flameExpiresAt > now) {
    const flameBonus = playerPowers.flame; // +1 range per flame powerup
    const totalRange = baseRange + flameBonus;
    console.log(`🔥 getPlayerBombRange: ${playerId} has range ${totalRange} (base: ${baseRange} + flame: ${flameBonus})`);
    return totalRange;
  }
  
  console.log(`🔥 getPlayerBombRange: ${playerId} has base range ${baseRange}`);
  return baseRange;
}

// Get player powerups
export function getPlayerPowerups(playerId) {
  return playerPowerups.get(playerId) || { bomb: 0, flame: 0, speed: 0, life: 0 };
}

// Cleanup expired powerups
export function cleanupExpiredPowerups() {
  const now = Date.now();
  let cleaned = false;
  
  playerPowerups.forEach((powers, playerId) => {
    if (powers.flameExpiresAt && powers.flameExpiresAt <= now && powers.flame > 0) {
      console.log(`🔥 ${playerId} flame powerup expired`);
      powers.flame = 0;
      powers.flameExpiresAt = null;
      cleaned = true;
    }
  });
  
  return cleaned;
}

// Run cleanup every second
setInterval(cleanupExpiredPowerups, 1000);