import { createContext, useContext, useEffect, useState } from "react";

export type ThemeAccent = "ocean-blue" | "royal-purple" | "emerald" | "deep-red" | "dark-minimal" | "clean-white";

export const THEMES: { id: ThemeAccent; label: string; emoji: string; primary: string }[] = [
  { id: "ocean-blue", label: "Ocean Blue", emoji: "🌊", primary: "221 83% 53%" },
  { id: "royal-purple", label: "Royal Purple", emoji: "👑", primary: "262 83% 58%" },
  { id: "emerald", label: "Emerald", emoji: "🌿", primary: "158 64% 42%" },
  { id: "deep-red", label: "Deep Red", emoji: "🌹", primary: "350 89% 52%" },
  { id: "dark-minimal", label: "Dark Minimal", emoji: "🌚", primary: "220 9% 46%" },
  { id: "clean-white", label: "Clean White", emoji: "🤍", primary: "215 25% 27%" },
];

interface ThemeContextType {
  accent: ThemeAccent;
  setAccent: (accent: ThemeAccent) => void;
  dark: boolean;
  toggleDark: () => void;
  THEMES: typeof THEMES;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<ThemeAccent>("ocean-blue");
  const [dark, setDarkState] = useState(false);

  useEffect(() => {
    const savedAccent = localStorage.getItem("aperti-accent") as ThemeAccent;
    if (savedAccent && THEMES.find((t) => t.id === savedAccent)) {
      setAccentState(savedAccent);
    }
    
    const savedDark = localStorage.getItem("aperti-dark");
    if (savedDark !== null) {
      setDarkState(savedDark === "true");
    } else {
      setDarkState(window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", accent);
    localStorage.setItem("aperti-accent", accent);
  }, [accent]);

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("aperti-dark", dark.toString());
  }, [dark]);

  const setAccent = (newAccent: ThemeAccent) => setAccentState(newAccent);
  const toggleDark = () => setDarkState((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ accent, setAccent, dark, toggleDark, THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
