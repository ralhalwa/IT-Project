import React from "react";

export default function GradientButton({
  children = "",
  className = "",
  colors = ["#ffaa40", "#9c40ff", "#ffaa40"],
  animationSpeed = 8,
  showBorder = true,
  onClick=()=>{},
  type = "button",
}) {
  const gradientStyle = {
    backgroundImage: `linear-gradient(to right, ${colors.join(", ")})`,
    animationDuration: `${animationSpeed}s`,
    backgroundSize: "300% 100%",
  };

  return (
    <button
      type={type as "button" | "submit" | "reset"}
      onClick={onClick}
      className={`
        relative overflow-hidden px-6 py-2 rounded-2xl font-semibold text-white shadow-md
        transition-all duration-300 ease-in-out cursor-pointer isolate z-0
        hover:shadow-lg hover:scale-[1.02]
        ${className}
      `}
    >
      {/* Gradient border if showBorder is true */}
      {showBorder && (
        <div
          className="absolute inset-0 z-[-1] animate-gradient rounded-2xl"
          style={gradientStyle}
        ></div>
      )}

      {/* Main animated background */}
      <div
        className={`
          absolute inset-[2px] rounded-[calc(1rem-2px)] z-[-1] bg-black
          before:absolute before:inset-0 before:z-[-1] before:rounded-inherit
          animate-gradient before:bg-cover
        `}
        style={{
          ...gradientStyle,
        }}
      ></div>

      {/* Button content */}
      <span className="relative z-10">{children}</span>
    </button>
  );
}
