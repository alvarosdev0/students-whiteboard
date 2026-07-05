# real-time-sync Specification

## Purpose

CRDT-based real-time collaboration via @tldraw/sync-core: canvas sync, cursor presence, element ownership, and connection lifecycle.

## Requirements

### REQ-SYNC-001: CRDT-Based Sync
The system MUST synchronize all canvas changes across room participants using tldraw's CRDT protocol via `@tldraw/sync-core`. Conflict resolution SHALL be automatic — no manual merge needed.

**Scenario:** GIVEN host draws a rectangle → WHEN participant simultaneously draws a circle → THEN both operations are merged via CRDT; both users see both shapes. Lost updates or forks SHALL NOT occur.

### REQ-SYNC-002: Cursor Presence
The system MUST display other users' cursors on the canvas with their display name and assigned color. Cursor position SHALL update in real-time (<100ms latency).

**Scenario:** GIVEN 3 users in a room → WHEN User A moves their cursor → THEN Users B and C see User A's name-tagged cursor in User A's assigned color.

### REQ-SYNC-003: Element Ownership
The system SHALL track which user created each canvas element (for display attribution, NOT for locking). Ownership metadata SHALL be visible on hover/selection. All participants MAY edit any element.

### REQ-SYNC-004: Connection States
The system SHALL display connection status: `connecting`, `synced` (green), `disconnected` (red with retry), `reconnecting` (yellow). On disconnect, a non-blocking banner SHALL appear.

**Scenario:** GIVEN user is synced → WHEN WebSocket drops → THEN status shows "reconnecting" with a spinner. If restored within 15s, status returns to "synced". If not, status shows "disconnected" with a manual "Reconnect" button.

## Edge Cases

| Case | Behavior |
|------|----------|
| Client reconnects after offline editing | CRDT merges offline changes with server state automatically. |
| Multiple rapid cursor updates | Server throttles cursor broadcasts to 15fps to avoid flooding. |
| Room has 10 participants | Sync performance MUST degrade gracefully — no visible lag. |
| Server restarts mid-session | All clients disconnect, then reconnect. CRDT resyncs state from any remaining connected peer or from server's last persisted state. |
| Network partition (split-brain) | Each partition continues independently. On reunion, CRDT merges both branches. |
