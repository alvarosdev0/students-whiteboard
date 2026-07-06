# Tasks: Collaborative Student Whiteboard

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 950–1050 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 → PR 5 → PR 6 |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Base |
|------|------|-----------|------|
| 1 | Scaffold + shared types (~205 lines) | PR 1 | feature/collaborative-whiteboard |
| 2 | Identity + persistence hooks (~130 lines) | PR 2 | PR 1 branch |
| 3 | Landing page + router (~140 lines) | PR 3 | PR 2 branch |
| 4 | Sync server (~220 lines) | PR 4 | PR 3 branch |
| 5 | Room page + tldraw (~160 lines) | PR 5 | PR 4 branch |
| 6 | Polish, deploy config, tests (~200 lines) | PR 6 | PR 5 branch |

## Phase 1: Scaffold & Shared Types — PR 1

- [x] T-001 Create `shared/types.ts`: `RoomCode`, `ParticipantRole`, `Participant` (id, name, color, role, connectedAt), `CreateRoomResponse`, `RoomStatus`, `ClientMessage`, `ServerMessage`. (~25 lines) — Deps: none — Reqs: ROOM-001, ROOM-006
- [x] T-002 Scaffold `client/`: `package.json` (vite, react, react-router, @tldraw/tldraw, @tldraw/sync, @tanstack/react-query), `vite.config.ts` (proxy /api→:8080, /ws→ws://:8080), `tsconfig.json`, `index.html`. (~110 lines) — Deps: none — Reqs: all client-side
- [x] T-003 Scaffold `server/`: `package.json` (express, ws, @tldraw/sync-core, uuid), `tsconfig.json`, `server/src/index.ts` skeleton (Express :8080, ws.Server attach). (~70 lines) — Deps: none — Reqs: all server-side

## Phase 2: Client Hooks — PR 2

- [ ] T-004 Create `client/src/hooks/useAnonymousIdentity.ts`: random name from ≥20 adjectives × ≥20 animals, random color from 16-color palette (avoid same-room collision), inline edit (2–30 chars, 2s debounce), persist `wb:user`. (~60 lines) — Deps: T-002 — Reqs: IDENTITY-001..005
- [ ] T-005 Create `client/src/hooks/useLocalStorage.ts`: auto-save `wb:{roomCode}:document` (2s debounce), restore/merge (server authoritative), `beforeunload` force-save, `navigator.storage.estimate()` quota warning at 4MB, prune oldest (keep 5). (~70 lines) — Deps: T-002 — Reqs: PERSIST-001..005

## Phase 3: Landing Page & Router — PR 3

- [ ] T-006 Create `client/src/components/LandingPage.tsx`: hero card, editable name display (from T-004 hook), "Create Whiteboard" button (POST /api/rooms → navigate /room/:code), join section (code input → GET /api/rooms/:code → navigate or "Room not found" error). (~120 lines) — Deps: T-004 — Reqs: ROOM-001, ROOM-002, IDENTITY-003
- [ ] T-007 Wire `App.tsx` + `main.tsx`: React Router v7 `<BrowserRouter>`, routes `/`→LandingPage, `/room/:roomId`→RoomPage placeholder, `<QueryClientProvider>`. (~20 lines) — Deps: T-006 — Reqs: ROOM-002

## Phase 4: Sync Server — PR 4

- [ ] T-008 Create `server/src/rooms.ts`: in-memory `Map<RoomCode,RoomState>`, code generation (5–6 uppercase, collision retry 3×→7 chars), create/validate/join/leave, `connectedAt` tracking, host promotion (30s timer→longest-connected→broadcast), room destruction on empty. (~120 lines) — Deps: T-001, T-003 — Reqs: ROOM-001..006
- [ ] T-009 Create `server/src/sync.ts` + wire `server/src/index.ts`: WebSocket upgrade at `/ws/:roomCode`, `TLSocketRoom` factory per room, CRDT relay, presence broadcast (15fps throttle), Express routes `POST /api/rooms` + `GET /api/rooms/:roomCode`. (~100 lines) — Deps: T-008 — Reqs: SYNC-001..004

## Phase 5: Room Page & Whiteboard — PR 5

- [ ] T-010 Create `client/src/components/RoomPage.tsx`: `<RoomHeader>` (room code, share `copyToClipboard`, participant count), `<TldrawEditor>` with `useSync({uri})`, `<ParticipantList>` sidebar (name from T-004, color, role badge), `<ConnectionBanner>` placeholder, `<ClearCanvas>` action (confirm→wipe+delete key). (~160 lines) — Deps: T-005, T-007, T-009 — Reqs: CANVAS-001..007, SYNC-001..004, PERSIST-005

## Phase 6: Polish & Deploy — PR 6

- [ ] T-011 Add connection states + error handling: ConnectionBanner with 4 states (connecting→synced green→reconnecting yellow→disconnected red+retry), "Room not found" redirect, image >10MB rejection toast, host-transfer notification, empty textbox blur-delete. (~80 lines) — Deps: T-010 — Reqs: SYNC-004, ROOM-002, CANVAS-004
- [ ] T-012 Deploy config + unit tests: `vercel.json` (SPA rewrites, env), Railway env (`PORT=8080`), Vitest tests for room code generation (T-008), name generator (T-004), localStorage hook (T-005). (~120 lines) — Deps: T-004, T-005, T-008 — Reqs: ROOM-001, IDENTITY-001, PERSIST-001
