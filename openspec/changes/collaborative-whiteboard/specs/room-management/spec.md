# room-management Specification

## Purpose

Room lifecycle management: create, join, leave, host identification, auto-transfer, and ephemeral cleanup.

## Requirements

### REQ-ROOM-001: Room Creation
The system MUST generate a unique, shareable room code (5–6 uppercase alphanumeric) when a user creates a room. The creator SHALL be designated HOST.

**Scenarios:**
- **Happy path**: GIVEN user on landing page → WHEN they click "Create Whiteboard" → THEN a room code is generated, the user connects as HOST, and a shareable link is displayed.
- **Duplicate code**: GIVEN a room code already exists → WHEN the server generates a new code → THEN it MUST retry until a unique code is produced.

### REQ-ROOM-002: Room Joining
The system MUST allow participants to join via a room code (typed or URL parameter `/room/:roomCode`). Non-existent codes SHALL show an error.

**Scenarios:**
- **Happy path**: GIVEN a valid room code → WHEN participant enters it and clicks "Join" → THEN they connect to the room as PARTICIPANT.
- **Invalid code**: GIVEN a non-existent or closed room code → WHEN participant submits it → THEN the system SHALL display "Room not found or has ended."

### REQ-ROOM-003: Room Leaving
The system MUST remove a participant from the room on explicit leave or disconnect. The room SHALL remain active as long as at least one participant is connected.

### REQ-ROOM-004: Host Transfer
The system MUST detect host disconnection and auto-promote the longest-connected participant to HOST after 30 seconds. If no participants remain, the room SHALL die.

**Scenarios:**
- **Auto-transfer**: GIVEN a room with host + 2 participants → WHEN host disconnects for 30s → THEN longest-connected participant becomes host, and all clients SHALL be notified.
- **Host returns**: GIVEN auto-transfer completed → WHEN original host reconnects → THEN they join as PARTICIPANT (not re-promoted).

### REQ-ROOM-005: Room Lifecycle
A room SHALL be active when ≥1 participant is connected. A room SHALL be destroyed (in-memory state cleared) when the last participant leaves. localStorage snapshots MAY persist locally after room death.

### REQ-ROOM-006: Room Code Format
Room codes MUST be 5–6 uppercase alphanumeric characters (e.g., `ABC12`, `MATH42`), URL-safe, and easy to share verbally.

## Edge Cases

| Case | Behavior |
|------|----------|
| Host refreshes page | Treated as disconnect; 30s timer starts. If reconnected within 30s, host role is retained. |
| Same user opens two tabs for same room | Each tab gets a separate session. Only one can be host. |
| Room code collision (<0.01% probability) | Server retries generation up to 3 times; if exhausted, extends code to 7 chars. |
| Participant joins dead room | Server returns "Room not found" and client redirects to landing page. |
