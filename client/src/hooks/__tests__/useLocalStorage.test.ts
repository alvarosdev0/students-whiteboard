// === useLocalStorage — Unit Tests ===

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLocalStorage, useWhiteboardPersistence } from "../useLocalStorage";

// --- localStorage mock ---

function mockLocalStorage(quotaLimit?: number) {
  const store: Record<string, string> = {};
  let quotaExceeded = false;

  return {
    getItem: vi.fn((key: string) => {
      if (quotaExceeded) throw new Error("QuotaExceededError");
      return store[key] ?? null;
    }),
    setItem: vi.fn((key: string, value: string) => {
      if (quotaLimit !== undefined && Object.keys(store).length >= quotaLimit) {
        const err = new DOMException("QuotaExceededError", "QuotaExceededError");
        throw err;
      }
      if (quotaExceeded) throw new Error("QuotaExceededError");
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
    store,
    forceQuotaExceeded: () => { quotaExceeded = true; },
    resetQuota: () => { quotaExceeded = false; },
  };
}

let ls: ReturnType<typeof mockLocalStorage>;

beforeEach(() => {
  ls = mockLocalStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: ls,
    writable: true,
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// --- Generic Hook Tests ---

describe("useLocalStorage", () => {
  it("returns initialValue when localStorage is empty", () => {
    const { result } = renderHook(() =>
      useLocalStorage("test:key", "default")
    );
    expect(result.current[0]).toBe("default");
  });

  it("restores existing value from localStorage", () => {
    localStorage.setItem("test:key", JSON.stringify("stored"));
    const { result } = renderHook(() =>
      useLocalStorage("test:key", "default")
    );
    expect(result.current[0]).toBe("stored");
  });

  it("falls back to initialValue on corrupted JSON", () => {
    localStorage.setItem("test:key", "not-json{{{{");
    const { result } = renderHook(() =>
      useLocalStorage("test:key", "fallback")
    );
    expect(result.current[0]).toBe("fallback");
  });

  it("setValue updates the value immediately", () => {
    const { result } = renderHook(() =>
      useLocalStorage("test:key", "initial")
    );
    act(() => {
      result.current[1]("updated");
    });
    expect(result.current[0]).toBe("updated");
  });

  it("setValue with function updater works", () => {
    const { result } = renderHook(() =>
      useLocalStorage<number>("test:num", 0)
    );
    act(() => {
      result.current[1]((prev) => prev + 1);
    });
    expect(result.current[0]).toBe(1);
  });

  it("debounces localStorage writes", () => {
    const { result } = renderHook(() =>
      useLocalStorage("test:key", "initial", 500)
    );

    act(() => {
      result.current[1]("first");
    });
    // Not saved yet (debounce)
    expect(ls.store["test:key"]).toBeUndefined();

    act(() => {
      result.current[1]("second");
    });

    // Still not saved
    expect(ls.store["test:key"]).toBeUndefined();

    // Advance past debounce
    vi.advanceTimersByTime(500);

    // Now saved with latest value
    expect(ls.store["test:key"]).toBe(JSON.stringify("second"));
  });

  it("resets debounce timer on rapid changes", () => {
    const { result } = renderHook(() =>
      useLocalStorage("test:key", "initial", 500)
    );

    act(() => { result.current[1]("a"); });
    vi.advanceTimersByTime(400);
    act(() => { result.current[1]("b"); }); // resets timer
    vi.advanceTimersByTime(400);
    // Still not saved (would have been at 500ms from first, but second reset)
    expect(ls.store["test:key"]).toBeUndefined();
    vi.advanceTimersByTime(100);
    expect(ls.store["test:key"]).toBe(JSON.stringify("b"));
  });

  it("handles quota exceeded gracefully", () => {
    ls.forceQuotaExceeded();

    const { result } = renderHook(() =>
      useLocalStorage("test:key", "initial", 0) // no debounce
    );

    act(() => {
      result.current[1]("try-save");
    });

    // Flush the setTimeout and let React process the setState inside it
    act(() => {
      vi.advanceTimersByTime(0);
    });

    // Value still updates in-memory
    expect(result.current[0]).toBe("try-save");
    // Error is set
    expect(result.current[2].error).not.toBeNull();
  });

  it("works with complex objects", () => {
    const complex = { users: [{ id: 1, name: "Alice" }], count: 42 };
    localStorage.setItem("test:complex", JSON.stringify(complex));
    const { result } = renderHook(() =>
      useLocalStorage<typeof complex>("test:complex", { users: [], count: 0 })
    );
    expect(result.current[0]).toEqual(complex);
  });

  it("returns error as null on successful save", () => {
    const { result } = renderHook(() =>
      useLocalStorage("test:key", "initial", 0)
    );
    act(() => {
      result.current[1]("saved");
    });
    expect(result.current[2].error).toBeNull();
  });
});

// --- Whiteboard Persistence Hook ---

describe("useWhiteboardPersistence", () => {
  it("uses wb:{roomCode}:document key pattern", () => {
    const snapshot = { elements: [] as unknown[] };
    localStorage.setItem("wb:ABC123:document", JSON.stringify(snapshot));
    const { result } = renderHook(() =>
      useWhiteboardPersistence("ABC123")
    );
    expect(result.current[0]).toEqual(snapshot);
  });

  it("returns null for empty whiteboard", () => {
    const { result } = renderHook(() =>
      useWhiteboardPersistence("EMPTY1")
    );
    expect(result.current[0]).toBeNull();
  });

  it("debounces at 2 seconds per spec", () => {
    const { result } = renderHook(() =>
      useWhiteboardPersistence("ROOM42")
    );

    act(() => {
      result.current[1](JSON.stringify({ shapes: 5 }));
    });

    vi.advanceTimersByTime(1900);
    expect(ls.store["wb:ROOM42:document"]).toBeUndefined();

    vi.advanceTimersByTime(100);
    expect(ls.store["wb:ROOM42:document"]).toBe(JSON.stringify(JSON.stringify({ shapes: 5 })));
  });
});
