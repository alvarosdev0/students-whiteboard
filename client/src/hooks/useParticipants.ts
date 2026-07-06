// === useParticipants — Custom Protocol Participants via Second WebSocket ===
// T-011: Opens a lightweight WebSocket to /sync/:roomCode for the custom
// protocol (join/nameChange) separate from tldraw's internal useSync socket.
//
// The server's handleSyncConnection already handles both TLSocketRoom CRDT
// sync AND custom JSON messages (join/leave/nameChange/hostChange) on the
// same endpoint — we just need a second connection for our app-level protocol.

import { useState, useEffect, useRef } from "react";
import type { Participant, ServerMessage } from "@shared/types";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useParticipants(
  roomCode: string,
  identity: { id: string; name: string; color: string },
) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // -------------------------------------------------------------------------
  // WebSocket lifecycle
  // -------------------------------------------------------------------------

  useEffect(() => {
    const syncServer =
      import.meta.env.VITE_SYNC_SERVER || "ws://localhost:8080";
    const ws = new WebSocket(`${syncServer}/sync/${roomCode}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "join",
          name: identity.name,
          color: identity.color,
        }),
      );
    };

    ws.onmessage = (event: MessageEvent) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        return; // Not JSON — ignore (binary tldraw data won't come on this socket)
      }

      switch (msg.type) {
        case "roomState":
          setParticipants(msg.participants);
          setHostId(msg.hostId || null);
          break;

        case "participantJoined":
          setParticipants((prev) => [
            ...prev.filter((p) => p.id !== msg.participant.id),
            msg.participant,
          ]);
          break;

        case "participantLeft":
          setParticipants((prev) => prev.filter((p) => p.id !== msg.id));
          break;

        case "nameChanged":
          setParticipants((prev) =>
            prev.map((p) =>
              p.id === msg.id ? { ...p, name: msg.name } : p,
            ),
          );
          break;

        case "hostChanged":
          setHostId(msg.newHostId);
          setParticipants((prev) =>
            prev.map((p) => ({
              ...p,
              role: p.id === msg.newHostId ? ("HOST" as const) : ("PARTICIPANT" as const),
            })),
          );
          break;

        // cursorMove / error — silently ignored for now (can be wired later)
        default:
          break;
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [roomCode]); // reconnect only if room changes

  // -------------------------------------------------------------------------
  // Name-change propagation
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: "nameChange", name: identity.name }),
      );
    }
  }, [identity.name]);

  return { participants, hostId } as const;
}
