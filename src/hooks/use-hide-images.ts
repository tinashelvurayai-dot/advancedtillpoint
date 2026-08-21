import { useEffect, useState } from "react";

const KEY = "hide_product_images";
const EVT = "hide-product-images-changed";

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

export function useHideImages(): [boolean, (v: boolean) => void] {
  const [hidden, setHidden] = useState<boolean>(read);

  useEffect(() => {
    const onChange = () => setHidden(read());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const set = (v: boolean) => {
    try {
      localStorage.setItem(KEY, v ? "true" : "false");
    } catch {
      /* ignore */
    }
    setHidden(v);
    window.dispatchEvent(new Event(EVT));
  };

  return [hidden, set];
}
