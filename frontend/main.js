// frontend/main.js
import { h } from "./framework/dom.js";
import { createRouter } from "./framework/router.js";

import BomberMario from "./game/Pages/BomberMario.js";
import Game from "./game/Pages/Game.js";
import NotFound from "./game/Pages/404.js";
import { GameOverScreen } from "./game/components/GameOverScreen.js"; 

// Small safety wrapper so a broken route doesn't crash everything
const safe = (viewFn) => {
  try {
    const v = viewFn?.();
    return (
      v ||
      h(
        "div",
        { class: "p-4 text-yellow-400" },
        "Empty view (no VDOM returned)"
      )
    );
  } catch (e) {
    console.error("Route render error:", e);
    return h(
      "div",
      { class: "p-4 text-red-400" },
      String(e?.message || e)
    );
  }
};

const routes = {
  // default route when hash is "#/" (or when router normalizes to "/")
  "/": () => safe(BomberMario),
"/lobby": () => safe(BomberMario), 
  // explicit route for "#/bombermario"
  "/bombermario": () => safe(BomberMario),

  // in-game view (router will go here when BomberMario calls navigate("/game"))
  "/game": () => safe(Game),
"/gameover": () => safe(GameOverScreen),
  // 404 + wildcard
  "/404": () => safe(NotFound),
  "*": () => safe(NotFound),
};

// Mount the mini-app inside the <div id="app"> that Next.js page renders
createRouter(routes, document.getElementById("app"));
  