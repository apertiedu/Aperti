import { createContext, useContext, useEffect, useState } from "react";

export type ThemeAccent = "aperti";

export const THEMES: { id: ThemeAccent; label: string; emoji: string; primary: string }[] = [
  { id: "aperti", label: "Aperti Teal", emoji: "🟢", primary: "173 100% 24%" },
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
  const [dark, setDarkState] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "aperti");
    const savedDark = localStorage.getItem("aperti-dark");
    if (savedDark !== null) {
      setDarkState(savedDark === "true");
    }
  }, []);

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("aperti-dark", dark.toString());
  }, [dark]);

  const setAccent = (_: ThemeAccent) => {};
  const toggleDark = () => setDarkState((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ accent: "aperti", setAccent, dark, toggleDark, THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
