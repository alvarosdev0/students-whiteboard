// === useAnonymousIdentity — Anonymous Student Identity ===
// Generates a random AdjectiveAnimal name + color on first visit.
// Persists to localStorage ("wb:user") and restores on return.

import { useState, useEffect, useCallback } from "react";

// --- Word Lists (not exported — only the hook needs them) ---

const ANIMALS = [
  "Panda", "Penguin", "Tiger", "Dolphin", "Fox", "Owl",
  "Wolf", "Rabbit", "Eagle", "Turtle", "Koala", "Lion",
  "Otter", "Falcon", "Lynx", "Gecko", "Raven", "Bear",
  "Hawk", "Phoenix",
] as const;

const ADJECTIVES = [
  "Curioso", "Veloz", "Astuto", "Sabio", "Alegre", "Creativo",
  "Brillante", "Audaz", "Tranquilo", "Ingenioso", "Valiente",
  "Divertido", "Feroz", "Amable", "Genial", "Sutil",
  "Épico", "Místico", "Ágil", "Radiante",
] as const;

const COLORS = [
  "#6366F1", // indigo
  "#EC4899", // pink
  "#F59E0B", // amber
  "#10B981", // emerald
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EF4444", // red
  "#06B6D4", // cyan
  "#F97316", // orange
  "#84CC16", // lime
  "#14B8A6", // teal
  "#A855F7", // purple
] as const;

const LS_KEY = "wb:user";

interface Identity {
  id: string;
  name: string;
  color: string;
}

// --- Pure helpers (exported for testing) ---

export function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateRandomName(): string {
  const adj = pickRandom(ADJECTIVES);
  const animal = pickRandom(ANIMALS);
  return `${adj}${animal}`;
}

export function generateRandomColor(): string {
  return pickRandom(COLORS);
}

export function generateIdentity(): Identity {
  return {
    id: crypto.randomUUID(),
    name: generateRandomName(),
    color: generateRandomColor(),
  };
}

export function loadIdentity(): Identity | null {
  const stored = localStorage.getItem(LS_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as Identity;
    if (parsed && typeof parsed.id === "string" && typeof parsed.name === "string" && typeof parsed.color === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveIdentity(identity: Identity): void {
  localStorage.setItem(LS_KEY, JSON.stringify(identity));
}

export function isValidName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 30;
}

// --- Hook ---

export function useAnonymousIdentity(): {
  id: string;
  name: string;
  color: string;
  setName: (name: string) => void;
} {
  const [identity, setIdentity] = useState<Identity>(() => {
    const existing = loadIdentity();
    if (existing) return existing;
    const fresh = generateIdentity();
    saveIdentity(fresh);
    return fresh;
  });

  // Persist on every identity change
  useEffect(() => {
    saveIdentity(identity);
  }, [identity]);

  const setName = useCallback((name: string) => {
    if (!isValidName(name)) return;
    setIdentity((prev) => ({ ...prev, name: name.trim() }));
  }, []);

  return {
    id: identity.id,
    name: identity.name,
    color: identity.color,
    setName,
  };
}
