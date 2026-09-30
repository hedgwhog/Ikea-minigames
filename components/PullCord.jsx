"use client";
// A cord hanging from the header (every page except the homepage, which has the big lamp).
// Pull it: light mode <-> dark mode.
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "@/context/ThemeContext";

export default function PullCord() {
  const { dark, toggle } = useTheme();
  const [pulled, setPulled] = useState(false);
  if (usePathname() === "/") return null;

  const pull = () => {
    setPulled(true);
    toggle();
    setTimeout(() => setPulled(false), 250);
  };
  return (
    <button
      onClick={pull}
      aria-label={dark ? "Pull for lights on" : "Pull for lights off"}
      title={dark ? "Lights on" : "Lights off"}
      className="absolute right-4 top-full z-50 flex flex-col items-center transition-transform duration-200 sm:right-8"
      style={{ transform: `translateY(${pulled ? 18 : 0}px)` }}
    >
      <span className="h-12 w-0.5 bg-ink/60" />
      <span className={`h-5 w-5 rounded-full border-2 border-ink ${dark ? "bg-panel" : "bg-yellow"}`} />
    </button>
  );
}
