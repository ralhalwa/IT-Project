import { h } from "../../framework/dom.js";
import { useState, useEffect } from "../../framework/hooks.js";

let globalShowError = null;

export function useErrorPopup() {
  const [errors, setErrors] = useState([]); // should be an array

  useEffect(() => {
    globalShowError = (rawMsg, duration = 3000) => {
      const msg = String(rawMsg ?? "").trim();
      if (!msg) return;

      const id = Date.now() + Math.random();

      // ✅ safe append (prev might not be an array in some edge cases)
      setErrors((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return [...safePrev, { id, msg }];
      });

      // ✅ safe remove after duration
      const ms = Number(duration);
      const safeDuration = Number.isFinite(ms) ? ms : 3000;

      setTimeout(() => {
        setErrors((prev) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          return safePrev.filter((e) => e.id !== id);
        });
      }, safeDuration);
    };

    return () => {
      globalShowError = null;
    };
  }, []);

  const safeErrors = Array.isArray(errors) ? errors : [];

  if (safeErrors.length === 0) return null;

  return h(
    "div",
    {
      class:
        "fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none",
    },
    ...safeErrors
      .filter(
        (e) =>
          e &&
          typeof e.id !== "undefined" &&
          typeof e.msg === "string" &&
          e.msg.length > 0
      )
      .map((e) =>
        h(
          "div",
          {
            key: e.id,
            class:
              "pixel-popup bg-[#ff4c4c] text-white border-4 border-black text-sm px-4 py-2 rounded-lg shadow-[4px_4px_0_0_#000] animate-pop pointer-events-auto",
            onClick: () =>
              setErrors((prev) => {
                const safePrev = Array.isArray(prev) ? prev : [];
                return safePrev.filter((er) => er.id !== e.id);
              }),
          },
          e.msg
        )
      )
  );
}

// ✅ Call this anywhere instead of alert("message")
export function showError(rawMsg, duration) {
  const msg = String(rawMsg ?? "").trim();
  if (!msg) return;

  if (typeof globalShowError === "function") {
    globalShowError(msg, duration);
  } else {
    // fallback if popup isn't mounted yet
    alert(msg);
  }
}
