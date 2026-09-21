import { useEffect, useState } from "react";

/**
 * Keeps the last scored queue in this browser so a reload does not cost a
 * triage session. Storage can be unavailable or full, and it is only a
 * convenience, so every access fails quietly.
 */
export function usePersisted<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      if (value === null || value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private window, blocked storage, or quota: the app still works */
    }
  }, [key, value]);

  return [value, setValue] as const;
}
