import { useEffect, useState } from "react";

const EVT = "tillpoint-prefs-changed";

function readFlag(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : raw === "true";
  } catch {
    return fallback;
  }
}

/** Small localStorage-backed boolean preference shared across the app. */
export function useBoolPref(key: string, fallback: boolean): [boolean, (v: boolean) => void] {
  // Start from the fallback so server and first client render agree, then sync.
  const [value, setValue] = useState(fallback);

  useEffect(() => {
    const sync = () => setValue(readFlag(key, fallback));
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [key, fallback]);

  const set = (v: boolean) => {
    try {
      window.localStorage.setItem(key, v ? "true" : "false");
    } catch {
      /* ignore */
    }
    setValue(v);
    window.dispatchEvent(new Event(EVT));
  };

  return [value, set];
}

export const SHOW_INSTALL_KEY = "tillpoint.show_install_button";

/** Whether the "Install app" button is visible on the landing page. */
export function useShowInstallButton() {
  return useBoolPref(SHOW_INSTALL_KEY, true);
}
