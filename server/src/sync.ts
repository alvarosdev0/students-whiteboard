import type { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import type { RoomCode, Participant, ServerMessage } from "../../shared/types.js";
import { getRoom, addParticipant, removeParticipant, getParticipants } from "./rooms.js";

// Maps participantId → raw ws (for broadcasting)
const sockets = new Map<string, WebSocket>();

export function handleSyncConnection(ws: WebSocket, roomCode: RoomCode, sessionId: string): void {
  const roomState = getRoom(roomCode);
  if (!roomState) { ws.close(4001, "Room not found"); return; }

  const participantId = sessionId || uuidv4();
  sockets.set(participantId, ws);

  // TLSocketRoom auto-wires via ws.on("message") — no adapter, no custom JSON
  roomState.room.handleSocketConnect({ sessionId: participantId, socket: ws as any });

  ws.on("close", () => {
    removeParticipant(roomCode, participantId);
    sockets.delete(participantId);
  });
}

// REST helpers — called from index.ts endpoints
export function joinRoom(roomCode: RoomCode, name: string, color: string): { participant: Participant; hostId: string | null } {
  const p: Participant = { id: uuidv4(), name, color, role: "PARTICIPANT", connectedAt: Date.now() };
  const { isHost, hostId } = addParticipant(roomCode, p);
  if (isHost) p.role = "HOST";
  return { participant: p, hostId };
}

export function updateName(roomCode: RoomCode, participantId: string, name: string): boolean {
  const s = getRoom(roomCode);
  if (!s) return false;
  const p = s.participants.get(participantId);
  if (!p) return false;
  p.name = name;
  return true;
}

export function listParticipants(roomCode: RoomCode): { participants: Participant[]; hostId: string | null } {
  return { participants: getParticipants(roomCode), hostId: getRoom(roomCode)?.hostId ?? null };
}
