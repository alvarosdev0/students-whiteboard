# client-persistence Specification

## Purpose

localStorage-based canvas snapshot persistence: auto-save, restore on reload, reconnection merge strategy, storage limits, and clear option.

## Requirements

### REQ-PERSIST-001: Auto-Save Snapshot
The system SHALL save the current canvas state to localStorage (`wb:{roomCode}:document`) on significant changes, debounced at 2 seconds. The snapshot MUST include the full tldraw document and session state.

**Scenario:** GIVEN user draws on canvas → WHEN 2 seconds pass without new edits → THEN a JSON snapshot is written to localStorage.

### REQ-PERSIST-002: Restore on Reload
On page reload, the system MUST restore the canvas from the localStorage snapshot if no server connection is available. If server is available, the server state SHALL take precedence.

**Scenario:** GIVEN user closes and reopens the tab → WHEN the page loads and server is reachable → THEN server CRDT state is loaded, and the local snapshot is discarded as stale.

### REQ-PERSIST-003: Reconnection Merge
On reconnection, the system SHALL merge the localStorage snapshot with the server's CRDT state. Server state SHALL be authoritative. If merge detects stale local data, it SHALL be silently discarded.

### REQ-PERSIST-004: Storage Limit Awareness
The system SHALL monitor localStorage usage via `navigator.storage.estimate()`. When usage exceeds 4MB (of ~5MB limit), the system SHALL display a non-blocking warning: "Storage almost full. Older whiteboards may not be saved."

**Scenario:** GIVEN localStorage usage reaches 4.5MB → WHEN next auto-save attempts → THEN a warning toast appears and oldest snapshots are pruned (keep last 5).

### REQ-PERSIST-005: Clear Canvas
The system SHALL provide a "Clear Canvas" action that wipes all elements from the current canvas and removes the corresponding localStorage snapshot. A confirmation dialog MUST precede the wipe.

**Scenario:** GIVEN user clicks "Clear Canvas" → WHEN they confirm the dialog → THEN all canvas elements are removed, the room state is cleared, and the localStorage key is deleted.

## Edge Cases

| Case | Behavior |
|------|----------|
| localStorage full (>5MB) | Save fails silently; user warned. Oldest snapshots pruned. |
| Corrupted localStorage JSON | Parse error caught; snapshot discarded; canvas starts fresh. |
| Multiple tabs writing to same key | Last write wins. Stale data discarded on next server sync. |
| Page close during debounce window | `beforeunload` handler forces immediate save. |
| Quota exceeded on mobile (Safari private mode ~0 bytes) | System degrades gracefully; canvas works without persistence. |
