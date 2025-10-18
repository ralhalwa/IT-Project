import { update } from './renderer.js';
let hooks = [];
let currentHook = 0;

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
    update(); // trigger re-render
  };

  const value = hooks[hookIndex];
  currentHook++;
  return [value, setState];
}

export function useEffect(callback, deps) {
  const idx = currentHook; // ✅ Corrected

  const prevDeps = hooks[idx];
  const hasChanged =
    !prevDeps || !deps || deps.some((d, i) => d !== prevDeps[i]);

  if (hasChanged) {
    queueMicrotask(() => callback());
    hooks[idx] = deps ? [...deps] : undefined;
  }

  currentHook++; // ✅ Corrected
}


export function useLocalStorageState(key, initialValue) {
  // read from localStorage once
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