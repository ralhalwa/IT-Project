import { h } from "../../framework/dom.js";
import { GRID_COLS, GRID_ROWS, CELL_SIZE } from "../Methods/mapGenerator.js";

export default function MapGrid({ gameMap, children }) { // accept children
  if (!Array.isArray(gameMap) || gameMap.length === 0) {
    return h(
      "div",
      {
        class:
          "flex items-center justify-center text-white text-2xl bg-black/40",
      },
      "Generating Game Map..."
    );
  }

  const cells = [];
  for (let r = 0; r < gameMap.length; r++) {
    for (let c = 0; c < gameMap[r].length; c++) {
      const cell = gameMap[r][c];
      let cellClass = "w-full h-full bg-cover bg-center";
      let cellStyle = "";

      switch (cell.type) {
        case "border":
        case "wall":
          cellStyle =
            "background-image: url('/assets/GreyWall.png'); image-rendering: pixelated;";
          break;
        case "block":
          cellStyle =
            "background-image: url('/assets/QBlock.png'); image-rendering: pixelated;";
          break;
        case "powerup":
          cellClass += " bg-[#7a7a7a] bg-opacity-70";
          cellStyle =
            "background-image: url('/assets/Sand.png'); image-rendering: pixelated;";
          break;
        default:
          cellClass += " bg-[#7a7a7a] bg-opacity-70";
          cellStyle =
            "background-image: url('/assets/Sand.png'); image-rendering: pixelated;";
      }

      cells.push(h("div", { class: cellClass, style: cellStyle }));
    }
  }

  const W = GRID_COLS * CELL_SIZE;
  const H = GRID_ROWS * CELL_SIZE;

  return h(
    "div",
    { class: "flex items-center justify-center" },
    h(
      "div",
      {
        class: "relative flex items-center justify-center",
        style: `
          width: ${W}px;
          height: ${H}px;
        `,
      },
      // Map grid
      h(
        "div",
        {
          class: "grid",
          style: `
            grid-template-columns: repeat(${GRID_COLS}, ${CELL_SIZE}px);
            grid-template-rows: repeat(${GRID_ROWS}, ${CELL_SIZE}px);
            width: ${W}px;
            height: ${H}px;
          `,
        },
        cells
      ),
      //  overlay layer for sprites
      h(
        "div",
        {
          class: "absolute inset-0 pointer-events-none",
          style: `width:${W}px; height:${H}px;`,
        },
        children || null
      )
    )
  );
}
