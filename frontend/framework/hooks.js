import { update } from "./renderer.js";

let hooks = [];
let currentHook = 0;
let framePending = false;
let effectDisposers = [];

export function resetHooks() {
  currentHook = 0;
}

export function useState(initialValue) {
  const hookIndex = currentHook;

  if (hooks[hookIndex] === undefined) {
    hooks[hookIndex] = initialValue;
  }

  const setState = (newValue) => {
    hooks[hookIndex] =
      typeof newValue === "function" ? newValue(hooks[hookIndex]) : newValue;

    if (!framePending) {
      framePending = true;
      requestAnimationFrame(() => {
        framePending = false;
        update();
      });
    }
  };

  const value = hooks[hookIndex];
  currentHook++;
  return [value, setState];
}

export function useEffect(callback, deps) {
  const idx = currentHook++;
  const prev = hooks[idx];

  const prevDeps = (prev && Array.isArray(prev.deps)) ? prev.deps : null;

  // changed if: first run, deps omitted, prev had no deps, length differs, or any value differs
  const changed =
    !prev ||
    !deps ||
    !prevDeps ||
    deps.length !== prevDeps.length ||
    deps.some((d, i) => d !== prevDeps[i]);

  if (changed) {
    if (prev && typeof prev.cleanup === "function") {
      // let previous cleanup run before installing the new effect
      try { prev.cleanup(); } catch {}
    }

    // run effect after paint
    requestAnimationFrame(() => {
      const maybeCleanup = callback();
      hooks[idx] = {
        deps: deps || [],
        cleanup: (typeof maybeCleanup === "function") ? maybeCleanup : null,
        __kind: "effect"
      };
    });
  } else {
    // keep previous record
    hooks[idx] = prev;
  }
}


export function useLocalStorageState(key, initialValue) {
  let storedValue;
  try {
    const stored = localStorage.getItem(key);
    storedValue = stored !== null ? JSON.parse(stored) : initialValue;
  } catch {
    storedValue = initialValue;
  }

  const [state, setStateBase] = useState(storedValue);

  const setValue = (newValue) => {
    setStateBase((prev) => {
      const value = typeof newValue === "function" ? newValue(prev) : newValue;
      localStorage.setItem(key, JSON.stringify(value));
      return value;
    });
  };

  return [state, setValue];
}

export function useRef(initialValue) {
  const idx = currentHook;
  const prev = hooks[idx];
  if (!prev || typeof prev !== "object" || !("current" in prev)) {
    hooks[idx] = { current: initialValue };
  }
  const ref = hooks[idx];
  currentHook++;
  return ref;
}
