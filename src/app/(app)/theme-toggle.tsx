"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { saveTheme, type Theme } from "./actions";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const systemTheme = (): Theme =>
  window.matchMedia(DARK_QUERY).matches ? "dark" : "light";

// Sets <html data-theme> and the localStorage copy the root layout's inline
// script reads. Null removes both, so the device's setting decides.
function apply(theme: Theme | null) {
  const root = document.documentElement;
  try {
    if (theme) {
      root.setAttribute("data-theme", theme);
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } else {
      root.removeAttribute("data-theme");
      localStorage.removeItem(THEME_STORAGE_KEY);
    }
  } catch {
    // Storage can be blocked; the attribute is already set.
  }
}

// Flips between light and dark and saves the choice to the profile.
export function ThemeToggle({ saved }: { saved: Theme | null }) {
  const [chosen, setChosen] = useState(saved);
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();
  // The server can't know the device's setting, so it renders as light.
  const system = useSyncExternalStore(subscribe, systemTheme, () => "light");
  const theme = chosen ?? system;

  // The profile wins over whatever another account left in this browser.
  useEffect(() => apply(saved), [saved]);

  function toggle() {
    const previous = chosen;
    const next: Theme = theme === "dark" ? "light" : "dark";
    setChosen(next);
    apply(next);
    startTransition(async () => {
      const result = await saveTheme(next);
      setError(result.error);
      if (result.error) {
        setChosen(previous);
        apply(previous);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 hover:bg-gray-100"
      >
        <span aria-hidden>{theme === "dark" ? "☀" : "☾"}</span>
      </button>
      {error && (
        <span role="alert" className="text-red-600">
          {error}
        </span>
      )}
    </>
  );
}
