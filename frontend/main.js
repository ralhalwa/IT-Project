
import { h } from "./framework/dom.js";
import { createRouter } from "./framework/router.js";
import BomberMario from "./game/Pages/BomberMario.js";
import NotFound from "./game/Pages/404.js";
import Game from "./game/Pages/game.js";

const safe = (viewFn) => {
  try {
    const v = viewFn?.();
    return v || h("div", { class: "p-4 text-yellow-400" }, "Empty view");
  } catch (e) {
    console.error("Route render error:", e);
    return h("div", { class: "p-4 text-red-400" }, String(e?.message || e));
  }
};
const routes = {
  "/": () => safe(BomberMario),
  "/bombermario": () => safe(BomberMario),   // ← important
  "/game": () => safe(Game),
  "/404": () => safe(NotFound),
  "*": () => safe(NotFound),
};

createRouter(routes, document.getElementById("app"));


