# Proposal: Collaborative Student Whiteboard

## Intent

Students need a zero-friction whiteboard for study groups — no accounts, no install, instant rooms. Current tools are deprecated (Jamboard), overkill (Miro), or lack real-time sync (Excalidraw). An ephemeral, anonymous classroom whiteboard fills this gap.

## Scope

### In Scope

- Host creates room → shareable link/code → participants join (2–10 per room)
- Canvas: freehand drawing, shapes (rect, circle, arrow, line), text, image paste, color picker
- Real-time sync: cursor presence, CRDT ops, host transfer on 30s disconnect
- Anonymous identity: auto-generated AnimalAdjective names, changeable
- Ephemeral rooms (lost when all leave) + localStorage snapshot backup
- Deploy: Vercel (SPA) + Railway (Node.js sync server)

### Out of Scope

- Accounts, auth, PostgreSQL, Prisma, SSR, mobile apps, file upload, video/audio
- Persistent rooms beyond session, admin dashboard, analytics, PDF export

## Capabilities

> Contract with sdd-spec. No existing specs — all new.

### New Capabilities

- `room-management`: Host creation, join-by-code, lifecycle, host-transfer
- `whiteboard-canvas`: tldraw canvas — drawing tools, shapes, text, images, color picker
- `real-time-sync`: WebSocket CRDT sync via @tldraw/sync-core, cursor presence
- `anonymous-identity`: Random AnimalAdjective name, changeable, no persistence
- `client-persistence`: localStorage snapshot save/restore for reconnect

### Modified Capabilities

None — greenfield project.

## Approach

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Vite + React 18 + React Router v7 SPA | Fast, mature, no SSR overhead |
| Canvas | @tldraw/tldraw | Built-in tools, paste, sync engine |
| Sync | @tldraw/sync + @tldraw/sync-core | CRDT protocol, TLSocketRoom |
| Server | Node.js + Express + ws | Official tldraw room pattern |
| Storage | In-memory + SQLite optional | Matches ephemeral study-session use case |

Vercel hosts SPA (`/` landing, `/room/:roomId` whiteboard). Railway runs Express+ws with TLSocketRooms per room. Client connects wss://, syncs CRDT ops. localStorage snapshots on leave, restores on reconnect.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `client/` | New | Vite + React SPA with tldraw |
| `server/` | New | Express + WebSocket sync server |
| `shared/` | New | Shared types (events, participants) |
| `openspec/config.yaml` | Modified | Update stack to match actual decisions |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Railway cold start (~30s) | Medium | Loading indicator; acceptable cadence |
| @tldraw/sync-core API instability | Low | Pin version; monitor changelog |
| Dead rooms (host disconnects, no peers) | Low | Intentional — ephemeral by design |
| Server restart loses all room state | Low | Matches requirement; localStorage backup |

## Rollback Plan

1. Redeploy previous Vercel + Railway commits
2. No data migration needed — ephemeral rooms have no persistent state
3. No DNS changes — use platform default domains

## Dependencies

- @tldraw/tldraw, @tldraw/sync, @tldraw/sync-core, ws, better-sqlite3
- Vercel + Railway free-tier accounts

## Success Criteria

- [ ] Host creates room, peer joins, draws in real-time (<2s latency)
- [ ] Host disconnect → role transfers within 30s
- [ ] Whiteboard survives page refresh via localStorage
- [ ] Anonymous name auto-generated, changeable in-session
- [ ] All tools functional (freehand, shapes, text, paste, color)
- [ ] Chrome, Firefox, Safari (desktop) supported
