// === useAnonymousIdentity — Unit Tests ===

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  pickRandom,
  generateRandomName,
  generateRandomColor,
  generateIdentity,
  loadIdentity,
  saveIdentity,
  isValidName,
  useAnonymousIdentity,
} from "../useAnonymousIdentity";

// --- localStorage mock ---

function mockLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
    store,
  };
}

let ls: ReturnType<typeof mockLocalStorage>;

beforeEach(() => {
  ls = mockLocalStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: ls,
    writable: true,
  });
  // Reset randomUUID mock
  Object.defineProperty(globalThis, "crypto", {
    value: {
      randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 10)}`),
    },
    writable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- Pure Function Tests ---

describe("pickRandom", () => {
  it("returns an element from the array", () => {
    const arr = ["a", "b", "c"] as const;
    const result = pickRandom(arr);
    expect(arr).toContain(result);
  });

  it("returns the only element for single-item array", () => {
    const arr = ["solo"] as const;
    expect(pickRandom(arr)).toBe("solo");
  });
});

describe("generateRandomName", () => {
  it("produces a name matching AdjectiveAnimal pattern", () => {
    // Force deterministic picks
    vi.spyOn(Math, "random").mockReturnValue(0);
    const name = generateRandomName();
    expect(name).toBe("CuriosoPanda"); // first adjective + first animal
  });

  it("always returns a non-empty string", () => {
    for (let i = 0; i < 50; i++) {
      const name = generateRandomName();
      expect(name.length).toBeGreaterThan(2);
    }
  });
});

describe("generateRandomColor", () => {
  it("returns a valid hex color from the palette", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(generateRandomColor()).toBe("#6366F1");
  });
});

describe("generateIdentity", () => {
  it("creates a valid identity with id, name, color", () => {
    const identity = generateIdentity();
    expect(identity).toHaveProperty("id");
    expect(identity).toHaveProperty("name");
    expect(identity).toHaveProperty("color");
    expect(typeof identity.id).toBe("string");
    expect(identity.id.length).toBeGreaterThan(0);
    expect(identity.name.length).toBeGreaterThan(2);
    expect(identity.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("generates unique IDs", () => {
    const a = generateIdentity();
    const b = generateIdentity();
    expect(a.id).not.toBe(b.id);
  });
});

describe("loadIdentity", () => {
  it("returns null when localStorage is empty", () => {
    expect(loadIdentity()).toBeNull();
  });

  it("restores a valid identity from localStorage", () => {
    const identity = { id: "abc", name: "TestFox", color: "#FF0000" };
    saveIdentity(identity);
    const restored = loadIdentity();
    expect(restored).toEqual(identity);
  });

  it("returns null for corrupted JSON", () => {
    localStorage.setItem("wb:user", "not-valid-json{{{");
    expect(loadIdentity()).toBeNull();
  });

  it("returns null for incomplete objects", () => {
    localStorage.setItem("wb:user", JSON.stringify({ id: "x" }));
    expect(loadIdentity()).toBeNull();
  });
});

describe("saveIdentity", () => {
  it("stores identity as JSON under wb:user key", () => {
    const identity = { id: "x", name: "Test", color: "#000" };
    saveIdentity(identity);
    expect(ls.store["wb:user"]).toBe(JSON.stringify(identity));
  });
});

describe("isValidName", () => {
  it("accepts names between 2 and 30 characters", () => {
    expect(isValidName("AB")).toBe(true);
    expect(isValidName("A name under 30 chars")).toBe(true);
  });

  it("rejects names shorter than 2 characters", () => {
    expect(isValidName("A")).toBe(false);
    expect(isValidName(" ")).toBe(false); // trimmed = ""
    expect(isValidName("")).toBe(false);
  });

  it("rejects names longer than 30 characters", () => {
    expect(isValidName("A".repeat(31))).toBe(false);
  });

  it("trims whitespace before validation", () => {
    expect(isValidName("  AB  ")).toBe(true);
    expect(isValidName("   ")).toBe(false);
  });
});

// --- Hook Tests ---

describe("useAnonymousIdentity", () => {
  it("returns identity with id, name, color, setName", () => {
    const { result } = renderHook(() => useAnonymousIdentity());
    expect(result.current.id).toBeDefined();
    expect(result.current.name).toBeDefined();
    expect(result.current.color).toBeDefined();
    expect(typeof result.current.setName).toBe("function");
  });

  it("generates a new identity when localStorage is empty", () => {
    const { result } = renderHook(() => useAnonymousIdentity());
    expect(result.current.name.length).toBeGreaterThan(2);
    expect(result.current.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("restores previous identity from localStorage", () => {
    saveIdentity({ id: "test-id", name: "StoredName", color: "#ABCDEF" });
    const { result } = renderHook(() => useAnonymousIdentity());
    expect(result.current.id).toBe("test-id");
    expect(result.current.name).toBe("StoredName");
    expect(result.current.color).toBe("#ABCDEF");
  });

  it("setName updates the name", () => {
    const { result } = renderHook(() => useAnonymousIdentity());
    act(() => {
      result.current.setName("NewName");
    });
    expect(result.current.name).toBe("NewName");
  });

  it("setName rejects invalid names", () => {
    const { result } = renderHook(() => useAnonymousIdentity());
    const original = result.current.name;
    act(() => {
      result.current.setName("A"); // too short
    });
    expect(result.current.name).toBe(original);
  });

  it("setName trims whitespace", () => {
    const { result } = renderHook(() => useAnonymousIdentity());
    act(() => {
      result.current.setName("  MyName  ");
    });
    expect(result.current.name).toBe("MyName");
  });

  it("persists changes to localStorage", () => {
    const { result } = renderHook(() => useAnonymousIdentity());
    act(() => {
      result.current.setName("Persisted");
    });
    const stored = JSON.parse(ls.store["wb:user"]);
    expect(stored.name).toBe("Persisted");
  });
});
