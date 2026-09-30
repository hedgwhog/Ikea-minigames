"use client";
// The big hanging lamp on the homepage. Click it: light mode <-> dark mode.
import { useState } from "react";
import { useTheme } from "@/context/ThemeContext";

export default function HomeLamp() {
  const { dark, toggle } = useTheme();
  const [swing, setSwing] = useState(0); // changes on every click -> restarts the swing animation

  return (
    <button
      onClick={() => (toggle(), setSwing((n) => n + 1))}
      aria-label={dark ? "Turn the lights on" : "Turn the lights off"}
      className="group absolute right-[6%] top-0 z-10 w-24 sm:w-32"
    >
      {/* warm light under the lamp */}
      {!dark && <span className="pointer-events-none absolute left-1/2 top-40 hidden h-72 w-96 -translate-x-1/2 rounded-full bg-yellow/25 blur-3xl sm:block" />}
      <svg key={swing} viewBox="0 0 128 230" className="relative w-full origin-top" style={{ animation: swing ? "swing 1s ease-out" : "none" }}>
      <line x1="64" y1="0" x2="64" y2="120" stroke="currentColor" strokeWidth="2.5" />
      <rect x="58" y="112" width="12" height="16" rx="3" fill="currentColor" />
      <circle cx="64" cy="200" r="13" fill={dark ? "#4b5566" : "#fff3b0"} style={{ filter: dark ? "none" : "drop-shadow(0 0 14px #ffe36b)" }} />
      <path d="M22 196 L44 128 L84 128 L106 196 Z" fill={dark ? "#2c3a4f" : "#0058a3"} />
      <path d="M22 196 L106 196" stroke={dark ? "#1f2a3a" : "#00407a"} strokeWidth="6" strokeLinecap="round" />
      </svg>
      <span className="block whitespace-nowrap text-xs font-bold text-muted group-hover:text-ink">{dark ? "Lights on" : "Click the lamp"}</span>
    </button>
  );
}
