// src/Components/BombsLayer.js
import { h } from "../../framework/dom.js";
import { CELL_SIZE } from "../Methods/mapGenerator.js";

export default function BombsLayer({ bombs }) {
  if (!Array.isArray(bombs) || bombs.length === 0) {
    return null;
  }

  return h(
    "div",
    { 
      class: "absolute inset-0 pointer-events-none z-[45]",
      style: "z-index: 45 !important;" 
    },
    bombs.map((b) => {
      
      return h("img", {
        key: b.id,
        src: "/assets/bomb.png",            
        alt: "bomb",
        class: "absolute select-none",
        style: `
          width:${CELL_SIZE}px;
          height:${CELL_SIZE}px;
          left:${b.c * CELL_SIZE}px;
          top:${b.r * CELL_SIZE}px;
          image-rendering: pixelated;
          z-index: 45;
          border: 3px solid red !important; /* ✅ Temporary debug border */
          background-color: rgba(255,0,0,0.3) !important; /* ✅ Temporary background */
          box-shadow: 0 0 10px yellow !important; /* ✅ Glow effect to make it visible */
        `,
        "data-bomb-id": b.id,
        onError: (e) => {
          e.target.style.display = 'none';
        }
      })
    })
  );
}