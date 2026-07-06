import { TLSocketRoom } from "@tldraw/sync-core";
import type { RoomCode, Participant, RoomStatus } from "../../shared/types.js";

// ---------------------------------------------------------------------------
// Room Manager — in-memory room storage with TLSocketRoom per room
// ---------------------------------------------------------------------------

export interface RoomState {
  room: TLSocketRoom;
  participants: Map<string, Participant>; // participantId → Participant
  hostId: string | null;
  createdAt: number;
  cleanupTimer?: ReturnType<typeof setTimeout>;
  hostTransferTimer?: ReturnType<typeof setTimeout>;
}

const rooms = new Map<RoomCode, RoomState>();

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusable chars
const CODE_LENGTH = 6;

// ---------------------------------------------------------------------------
// Room code generation
// ---------------------------------------------------------------------------

export function generateRoomCode(length: number = CODE_LENGTH): RoomCode {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function createRoom(): RoomCode {
  let code = generateRoomCode();

  // Collision detection with retry: 3 attempts at 6 chars, then extend to 7
  if (rooms.has(code)) {
    for (let attempt = 0; attempt < 2; attempt++) {
      code = generateRoomCode();
      if (!rooms.has(code)) break;
    }
    // All 6-char attempts collided — extend to 7 characters
    if (rooms.has(code)) {
      for (let attempt = 0; attempt < 3; attempt++) {
        code = generateRoomCode(7);
        if (!rooms.has(code)) break;
      }
      if (rooms.has(code)) {
        throw new Error("Failed to generate unique room code after retries");
      }
    }
  }

  const room = new TLSocketRoom({
    log: { error: console.error, warn: console.warn },
    onSessionRemoved: (_room, { numSessionsRemaining }) => {
      // When all TLSocketRoom sessions end, schedule room cleanup
      if (numSessionsRemaining === 0) {
        scheduleCleanup(code);
      }
    },
  });

  rooms.set(code, {
    room,
    participants: new Map(),
    hostId: null,
    createdAt: Date.now(),
  });

  console.log(`Room created: ${code}`);
  return code;
}

export function getRoom(code: RoomCode): RoomState | undefined {
  return rooms.get(code);
}

export function roomExists(code: RoomCode): boolean {
  return rooms.has(code);
}

export function getRoomStatus(code: RoomCode): RoomStatus {
  const state = rooms.get(code);
  if (!state) return { exists: false, participantCount: 0 };
  return {
    exists: true,
    participantCount: state.participants.size,
  };
}

export function deleteRoom(code: RoomCode): void {
  const state = rooms.get(code);
  if (!state) return;

  clearTimers(state);
  state.room.close();
  rooms.delete(code);
  console.log(`Room deleted: ${code}`);
}

// ---------------------------------------------------------------------------
// Participant management
// ---------------------------------------------------------------------------

/**
 * Add or update a participant in a room.
 * First participant automatically becomes HOST.
 * Returns whether the participant is host.
 */
export function addParticipant(
  code: RoomCode,
  participant: Participant
): { isHost: boolean; hostId: string | null } {
  const state = rooms.get(code);
  if (!state) throw new Error(`Room ${code} not found`);

  // Cancel cleanup timer when someone joins
  cancelCleanupTimer(state);

  const isReconnecting = state.participants.has(participant.id);
  state.participants.set(participant.id, participant);

  // First participant becomes host
  if (state.hostId === null) {
    participant.role = "HOST";
    state.hostId = participant.id;
  }

  // Reconnecting host — cancel transfer timer, restore host role
  if (isReconnecting && state.hostId === participant.id) {
    participant.role = "HOST";
    cancelHostTransferTimer(state);
  }

  return { isHost: participant.role === "HOST", hostId: state.hostId };
}

/**
 * Remove a participant. If the removed participant was HOST,
 * schedules a 30s transfer timer to promote the oldest-connected
 * remaining participant.
 */
export function removeParticipant(
  code: RoomCode,
  participantId: string
): { removed: Participant | undefined; newHostId: string | null } {
  const state = rooms.get(code);
  if (!state) return { removed: undefined, newHostId: null };

  const participant = state.participants.get(participantId);
  if (!participant) return { removed: undefined, newHostId: null };

  state.participants.delete(participantId);

  let newHostId: string | null = null;

  if (state.hostId === participantId && state.participants.size > 0) {
    // HOST left — start 30s grace period before transferring
    state.hostTransferTimer = setTimeout(() => {
      // Re-read state — might have changed during the 30s
      const current = rooms.get(code);
      if (!current || current.hostId !== participantId) return;

      const oldest = getOldestParticipant(code);
      if (oldest) {
        oldest.role = "HOST";
        current.hostId = oldest.id;
        newHostId = oldest.id;
      }
      current.hostTransferTimer = undefined;
    }, 30_000);
  } else if (state.participants.size === 0) {
    state.hostId = null;
  }

  return { removed: participant, newHostId };
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export function getParticipants(code: RoomCode): Participant[] {
  const state = rooms.get(code);
  if (!state) return [];
  return [...state.participants.values()];
}

export function getHostId(code: RoomCode): string | null {
  return rooms.get(code)?.hostId ?? null;
}

/**
 * Get host ID and also finalize any pending transfer.
 * Call this when you need the definitive host (e.g., for broadcasting).
 */
export function resolveHostId(code: RoomCode): string | null {
  const state = rooms.get(code);
  if (!state) return null;

  // If transfer timer expired but host wasn't resolved yet, resolve now
  if (
    state.hostId &&
    state.participants.size > 0 &&
    !state.participants.has(state.hostId) &&
    !state.hostTransferTimer
  ) {
    // Timer already fired but host wasn't updated — fix it
    const oldest = getOldestParticipant(code);
    if (oldest) {
      oldest.role = "HOST";
      state.hostId = oldest.id;
    }
  }

  return state.hostId;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getOldestParticipant(code: RoomCode): Participant | undefined {
  const state = rooms.get(code);
  if (!state || state.participants.size === 0) return undefined;

  return [...state.participants.values()].sort(
    (a, b) => a.connectedAt - b.connectedAt
  )[0];
}

function cancelCleanupTimer(state: RoomState): void {
  if (state.cleanupTimer) {
    clearTimeout(state.cleanupTimer);
    state.cleanupTimer = undefined;
  }
}

function cancelHostTransferTimer(state: RoomState): void {
  if (state.hostTransferTimer) {
    clearTimeout(state.hostTransferTimer);
    state.hostTransferTimer = undefined;
  }
}

function clearTimers(state: RoomState): void {
  cancelCleanupTimer(state);
  cancelHostTransferTimer(state);
}

function scheduleCleanup(code: RoomCode): void {
  const state = rooms.get(code);
  if (!state) return;

  state.cleanupTimer = setTimeout(() => {
    // Only delete if still empty after grace period
    const s = rooms.get(code);
    if (s && s.participants.size === 0 && s.room.getNumActiveSessions() === 0) {
      deleteRoom(code);
    }
  }, 60_000);
}
