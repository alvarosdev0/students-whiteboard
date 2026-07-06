import type { WebSocket } from "ws";
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
} from "./rooms.js";

// ---------------------------------------------------------------------------
// Per-connection state (custom protocol broadcasting)
// ---------------------------------------------------------------------------

const participantSockets = new Map<string, WebSocket>();
const lastCursorBroadcast = new Map<string, number>();
const CURSOR_THROTTLE_MS = 66; // 15fps

// ---------------------------------------------------------------------------
// Connection handler
// ---------------------------------------------------------------------------

/**
 * Handle a new WebSocket sync connection for a room.
 *
 * Pattern follows the official tldraw simple-server-example:
 *   - Pass raw ws socket to handleSocketConnect — TLSocketRoom auto-wires
 *     via ws.on("message"), no adapter or manual handleSocketMessage needed.
 *   - Custom JSON messages (join/leave/cursor/nameChange) are handled
 *     in a separate on("message") listener that skips non-JSON data.
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

  // ---- TLSocketRoom CRDT sync (raw ws, auto-wired) ----
  // TLSocketRoom internally uses ws.on("message") / ws.on("close")
  // to handle the tldraw sync protocol. No adapter needed.
  roomState.room.handleSocketConnect({
    sessionId: participantId,
    socket: ws as any, // ws satisfies send/close/readyState/on — works natively
  });

  // ---- Custom protocol handler (join/leave/cursor/nameChange) ----
  ws.on("message", (data: Buffer) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return; // Not JSON → tldraw binary protocol → TLSocketRoom handles it
    }

    switch (msg.type) {
      case "join":
        handleJoin(roomCode, participantId, msg.name, msg.color, ws);
        break;
      case "leave":
        handleLeave(roomCode, participantId);
        break;
      case "nameChange":
        handleNameChange(roomCode, participantId, msg.name);
        break;
      case "cursor":
        handleCursor(roomCode, participantId, msg.x, msg.y);
        break;
    }
  });

  // ---- Disconnect cleanup ----
  ws.on("close", () => {
    handleLeave(roomCode, participantId);
    participantSockets.delete(participantId);
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
  sendTo(ws, {
    type: "roomState",
    participants,
    hostId: hostId ?? "",
  });

  // Broadcast join to others
  broadcastToRoom(roomCode, { type: "participantJoined", participant }, participantId);
}

function handleLeave(roomCode: RoomCode, participantId: string): void {
  const { removed, newHostId } = removeParticipant(roomCode, participantId);
  if (!removed) return;

  broadcastToRoom(roomCode, { type: "participantLeft", id: participantId });

  if (newHostId) {
    broadcastToRoom(roomCode, { type: "hostChanged", newHostId });
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

  broadcastToRoom(roomCode, { type: "nameChanged", id: participantId, name });
}

function handleCursor(
  roomCode: RoomCode,
  participantId: string,
  x: number,
  y: number
): void {
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
// Broadcasting helpers
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
    if (sock?.readyState === 1) {
      sock.send(data);
    }
  }
}
