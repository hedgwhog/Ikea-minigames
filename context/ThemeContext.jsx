"use client";
// Light / dark mode for the whole site. The lamp in the header switches it.
// The choice is saved in a cookie, so the SERVER can render the right mode (no flash).
import { createContext, useContext, useMemo, useState } from "react";

const ThemeContext = createContext(null);
export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ initial, children }) {
  const [theme, setTheme] = useState(initial);

  // useMemo: the value object only changes when the theme changes
  const value = useMemo(() => {
    const toggle = () => {
      const next = theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      document.cookie = `theme=${next}; path=/; max-age=31536000`;
      setTheme(next);
    };
    return { theme, dark: theme === "dark", toggle };
  }, [theme]);

  return <ThemeContext value={value}>{children}</ThemeContext>;
}
