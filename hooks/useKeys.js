import { useEffect, useRef } from "react";

// Which keys are held right now (a Set in a ref: holding a key doesn't re-render).
// onPress(key) runs once per press. Touch buttons can add keys to the same Set.
export function useKeys(onPress) {
  const keys = useRef(new Set());
  const press = useRef(onPress);
  useEffect(() => {
    press.current = onPress;
  });
  useEffect(() => {
    const down = (e) => {
      if (e.target.tagName === "INPUT") return;
      const key = e.key.toLowerCase();
      if (key.startsWith("arrow") || key === " ") e.preventDefault(); // don't scroll
      keys.current.add(key);
      if (!e.repeat) press.current?.(key);
    };
    const up = (e) => keys.current.delete(e.key.toLowerCase());
    const clear = () => keys.current.clear();
    addEventListener("keydown", down);
    addEventListener("keyup", up);
    addEventListener("blur", clear);
    return () => (removeEventListener("keydown", down), removeEventListener("keyup", up), removeEventListener("blur", clear));
  }, []);
  return keys;
}

// WASD / arrows -> { x, y } between -1 and 1
export function direction(keys) {
  const k = keys.current;
  const x = (k.has("d") || k.has("arrowright")) - (k.has("a") || k.has("arrowleft"));
  const y = (k.has("s") || k.has("arrowdown")) - (k.has("w") || k.has("arrowup"));
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}
