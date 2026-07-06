import type { WebSocket } from "ws";
import type { WebSocketMinimal } from "@tldraw/sync-core";
import { v4 as uuidv4 } from "uuid";
import type {
  RoomCode,
  Participant,
  ClientMessage,
  ServerMessage,
} from "../../shared/types.js";
import {
  getRoom,
  addParticipant,
  removeParticipant,
  getParticipants,
  resolveHostId,
} from "./rooms.js";

// ---------------------------------------------------------------------------
// ws → WebSocketMinimal adapter for TLSocketRoom
// ---------------------------------------------------------------------------

/**
 * Adapts a `ws` WebSocket to the {@link WebSocketMinimal} interface that
 * TLSocketRoom expects.  The `ws` library uses EventEmitter (.on / .off)
 * whereas TLSocketRoom calls addEventListener / removeEventListener.
 */
export function adaptWsSocket(ws: WebSocket): WebSocketMinimal {
  const listeners: Record<string, Array<(event: any) => void>> = {
    message: [],
    close: [],
    error: [],
  };

  ws.on("message", (data: Buffer) => {
    const event = { data: data.toString() };
    for (const fn of listeners.message) fn(event);
  });

  ws.on("close", (code: number, reason: Buffer) => {
    const event = { code, reason: reason?.toString() ?? "" };
    for (const fn of listeners.close) fn(event);
  });

  ws.on("error", (error: Error) => {
    const event = { error };
    for (const fn of listeners.error) fn(event);
  });

  return {
    addEventListener(type, listener) {
      listeners[type]?.push(listener);
    },
    removeEventListener(type, listener) {
      const arr = listeners[type];
      if (arr) listeners[type] = arr.filter((l) => l !== listener);
    },
    send(data: string) {
      if (ws.readyState === 1) ws.send(data);
    },
    close(code?: number, reason?: string) {
      ws.close(code, reason);
    },
    get readyState() {
      return ws.readyState;
    },
  };
}

// ---------------------------------------------------------------------------
// Per-connection state tracking (for custom-message broadcasting)
// ---------------------------------------------------------------------------

const participantSockets = new Map<string, WebSocket>(); // participantId → raw ws
const lastCursorBroadcast = new Map<string, number>(); // participantId → timestamp
const CURSOR_THROTTLE_MS = 66; // 15fps ~= 66ms between broadcasts

// ---------------------------------------------------------------------------
// Connection handler
// ---------------------------------------------------------------------------

/**
 * Handle a new WebSocket sync connection for a given room.
 *
 * 1. Validates the room exists.
 * 2. Creates a TLSocketRoom adapter and registers for CRDT sync.
 * 3. Listens for custom client messages (join, leave, cursor, nameChange).
 * 4. Handles disconnect / host transfer / cleanup.
 */
export function handleSyncConnection(
  ws: WebSocket,
  roomCode: RoomCode,
  sessionId: string
): void {
  const roomState = getRoom(roomCode);
  if (!roomState) {
    ws.close(4001, "Room not found");
    return;
  }

  const participantId = sessionId || uuidv4();
  participantSockets.set(participantId, ws);

  // ---- TLSocketRoom CRDT sync ----
  const socketAdapter = adaptWsSocket(ws);
  roomState.room.handleSocketConnect({
    sessionId: participantId,
    socket: socketAdapter,
  });

  // ---- Custom protocol handler ----
  ws.on("message", (data: Buffer) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      // Non-JSON (chunked tldraw messages) — TLSocketRoom handles those
      return;
    }

    switch (msg.type) {
      case "join": {
        handleJoin(roomCode, participantId, msg.name, msg.color, ws);
        break;
      }
      case "leave": {
        handleLeave(roomCode, participantId);
        break;
      }
      case "nameChange": {
        handleNameChange(roomCode, participantId, msg.name);
        break;
      }
      case "cursor": {
        handleCursor(roomCode, participantId, msg.x, msg.y, ws);
        break;
      }
      // Unknown / tldraw-internal messages — ignored here, TLSocketRoom handles them
      default:
        break;
    }
  });

  // ---- Disconnect ----
  ws.on("close", () => {
    handleLeave(roomCode, participantId);
    roomState.room.handleSocketClose(participantId);
    participantSockets.delete(participantId);
  });

  ws.on("error", () => {
    roomState.room.handleSocketError(participantId);
  });
}

// ---------------------------------------------------------------------------
// Custom message handlers
// ---------------------------------------------------------------------------

function handleJoin(
  roomCode: RoomCode,
  participantId: string,
  name: string,
  color: string,
  ws: WebSocket
): void {
  const participant: Participant = {
    id: participantId,
    name,
    color,
    role: "PARTICIPANT",
    connectedAt: Date.now(),
  };

  const { isHost, hostId } = addParticipant(roomCode, participant);
  if (isHost) participant.role = "HOST";

  // Send full room state to the joining participant
  const participants = getParticipants(roomCode);
  const stateMsg: ServerMessage = {
    type: "roomState",
    participants,
    hostId: hostId ?? "",
  };
  sendTo(ws, stateMsg);

  // Broadcast join to others
  const joinMsg: ServerMessage = {
    type: "participantJoined",
    participant,
  };
  broadcastToRoom(roomCode, joinMsg, participantId);
}

function handleLeave(roomCode: RoomCode, participantId: string): void {
  const { removed, newHostId } = removeParticipant(roomCode, participantId);
  if (!removed) return;

  // Broadcast departure
  broadcastToRoom(roomCode, { type: "participantLeft", id: participantId });

  // If host transfer resolved, broadcast it
  if (newHostId) {
    broadcastToRoom(roomCode, {
      type: "hostChanged",
      newHostId,
    });
  }
}

function handleNameChange(
  roomCode: RoomCode,
  participantId: string,
  name: string
): void {
  const state = getRoom(roomCode);
  if (!state) return;

  const pt = state.participants.get(participantId);
  if (pt) pt.name = name;

  broadcastToRoom(roomCode, {
    type: "nameChanged",
    id: participantId,
    name,
  });
}

function handleCursor(
  roomCode: RoomCode,
  participantId: string,
  x: number,
  y: number,
  _ws: WebSocket
): void {
  // Throttle cursor broadcasts to 15fps
  const now = Date.now();
  const last = lastCursorBroadcast.get(participantId) ?? 0;
  if (now - last < CURSOR_THROTTLE_MS) return;
  lastCursorBroadcast.set(participantId, now);

  broadcastToRoom(
    roomCode,
    { type: "cursorMove", id: participantId, x, y },
    participantId
  );
}

// ---------------------------------------------------------------------------
// Broadcasting
// ---------------------------------------------------------------------------

function sendTo(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(message));
  }
}

function broadcastToRoom(
  roomCode: RoomCode,
  message: ServerMessage,
  excludeParticipantId?: string
): void {
  const state = getRoom(roomCode);
  if (!state) return;

  const data = JSON.stringify(message);

  for (const [id] of state.participants) {
    if (id === excludeParticipantId) continue;
    const sock = participantSockets.get(id);
    if (sock && sock.readyState === 1) {
      sock.send(data);
    }
  }
}
