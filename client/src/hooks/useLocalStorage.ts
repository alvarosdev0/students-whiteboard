// === useLocalStorage — Generic localStorage Hook ===
// Reads on mount, auto-saves on change (debounced), handles errors gracefully.
// Safari private mode (quota 0): returns initialValue, skips saves, reports error.
// Quota exceeded: in-memory state still updates, error is reported.

import { useState, useEffect, useRef, useCallback } from "react";

// --- Helpers ---

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupted JSON or storage unavailable (Safari private mode)
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): { success: boolean; error: string | null } {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { success: true, error: null };
  } catch (err: unknown) {
    // Safari private mode or quota exceeded
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[useLocalStorage] Failed to save "${key}": ${message}`);
    return { success: false, error: message };
  }
}

// --- Generic Hook ---

/**
 * Generic hook for reading/writing a value to localStorage.
 *
 * @param key          localStorage key
 * @param initialValue Value used when localStorage is empty, corrupted, or unavailable
 * @param debounceMs   Delay before auto-saving changes (default 500ms)
 *
 * @returns [value, setValue, { error: string | null }]
 *
 * Error handling:
 * - Safari private mode (quota 0): returns initialValue; writes are skipped silently.
 * - Quota exceeded: in-memory state updates; error is reported via `{ error }`.
 * - Corrupted JSON: falls back to initialValue.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  debounceMs: number = 500,
): [T, (value: T | ((prev: T) => T)) => void, { error: string | null }] {
  const [value, setValueInternal] = useState<T>(() => readJSON(key, initialValue));
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist value (debounced)
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const result = writeJSON(key, value);
      if (!result.success) {
        setError(result.error);
      } else {
        setError(null);
      }
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [key, value, debounceMs]);

  const setValue = useCallback((newValue: T | ((prev: T) => T)) => {
    setValueInternal((prev) => {
      if (typeof newValue === "function") {
        return (newValue as (prev: T) => T)(prev);
      }
      return newValue;
    });
  }, []);

  return [value, setValue, { error }];
}

// --- Whiteboard Persistence Hook ---

/**
 * Specialized hook for persisting whiteboard snapshots.
 * Uses a 2-second debounce (per REQ-PERSIST-001) and the "wb:{roomCode}:document" key pattern.
 */
export function useWhiteboardPersistence(roomCode: string) {
  const key = `wb:${roomCode}:document`;
  return useLocalStorage<string | null>(key, null, 2000);
}
