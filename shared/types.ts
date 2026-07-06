// === Collaborative Whiteboard — Shared Types ===
// Zero-dependency types shared between client/ and server/.

export type RoomCode = string; // 5-6 uppercase alphanumeric

export type ParticipantRole = "HOST" | "PARTICIPANT";

export interface Participant {
  id: string; // UUID (client-generated)
  name: string; // e.g. "CuriousPenguin"
  color: string; // hex
  role: ParticipantRole;
  connectedAt: number; // Date.now()
}

export interface CreateRoomResponse {
  roomCode: RoomCode;
}

export interface RoomStatus {
  exists: boolean;
  participantCount: number;
}

// === Client-Server Message Protocol ===

export type ClientMessage =
  | { type: "join"; name: string; color: string }
  | { type: "leave" }
  | { type: "cursor"; x: number; y: number }
  | { type: "nameChange"; name: string };

export type ServerMessage =
  | { type: "roomState"; participants: Participant[]; hostId: string }
  | { type: "participantJoined"; participant: Participant }
  | { type: "participantLeft"; id: string }
  | { type: "hostChanged"; newHostId: string }
  | { type: "cursorMove"; id: string; x: number; y: number }
  | { type: "nameChanged"; id: string; name: string }
  | { type: "error"; code: string; message: string };
