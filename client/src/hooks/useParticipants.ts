import { useState, useEffect, useRef } from "react";
import type { Participant } from "@shared/types";

const POLL_MS = 3000;

export function useParticipants(roomCode: string, identity: { name: string; color: string }) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const participantIdRef = useRef<string | null>(null);
  const joinedRef = useRef(false);

  // Join on mount
  useEffect(() => {
    if (joinedRef.current) return;
    joinedRef.current = true;

    fetch(`/api/rooms/${roomCode}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: identity.name, color: identity.color }),
    })
      .then(r => r.json())
      .then(d => { participantIdRef.current = d.participant?.id ?? null; })
      .catch(() => {});
  }, [roomCode]);

  // Poll participants
  useEffect(() => {
    const poll = () => {
      fetch(`/api/rooms/${roomCode}/participants`)
        .then(r => r.json())
        .then(d => {
          setParticipants(d.participants ?? []);
          setHostId(d.hostId ?? null);
        })
        .catch(() => {});
    };
    poll();
    const i = setInterval(poll, POLL_MS);
    return () => clearInterval(i);
  }, [roomCode]);

  // Send name change
  useEffect(() => {
    if (!participantIdRef.current) return;
    fetch(`/api/rooms/${roomCode}/name`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: participantIdRef.current, name: identity.name }),
    }).catch(() => {});
  }, [identity.name, roomCode]);

  return { participants, hostId, participantId: participantIdRef.current };
}
