// frontend/game/Pages/404.js
import { h } from "../../framework/dom.js";

export default function NotFound() {
  return h("div", { class: "p-6 text-red-400" }, "404 — Page not found");
}
