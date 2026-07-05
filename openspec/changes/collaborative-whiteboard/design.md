# Design: Collaborative Student Whiteboard

## Technical Approach

tldraw CRDT sync via `@tldraw/sync-core` TLSocketRoom on a standalone Express+ws server. Vite SPA wraps tldraw's `useSync` for the canvas. Room ops (create/validate) use REST; drawing sync uses WebSocket upgrade. Ephemeral rooms die with last participant; localStorage provides client-side backup.

## Architecture Decisions

| Decision | Option | Tradeoff | Choice |
|----------|--------|----------|--------|
| Canvas engine | tldraw vs Excalidraw vs Fabric.js | tldraw: built-in CRDT sync, React SDK, images/paste/clipboard. Excalidraw: no live collab protocol. Fabric: lower-level. | **tldraw** |
| Sync protocol | @tldraw/sync-core vs Yjs + manual sync | tldraw sync-core is purpose-built for the canvas. Yjs adds integration complexity without benefit. | **@tldraw/sync-core** |
| Room persistence | In-memory only vs SQLite-backed | In-memory matches "ephemeral by design" requirement. SQLite adds server-side snapshot resilience at low cost. | **In-memory + optional SQLite** |
| Host transfer | Oldest participant vs most-active | Oldest-connected is deterministic, simple to track. Activity metrics add complexity. | **Oldest-connected participant** |

## System Architecture

```
Browser (React SPA)
    │  wss:// ┌── REST (create/validate room)
    ▼         ▼
┌────────────  Railway (Node.js)  ───────────┐
│  Express ──► /api/rooms (create, validate)  │
│  ws ──► TLSocketRoom per room               │
│         (CRDT relay + host tracking)         │
└─────────────────────────────────────────────┘
                  │
          SQLite (optional snapshot)
```

```
App (Vite + React Router v7 SPA)
├── /              → LandingPage
│   ├── NameInput (auto-generated AnimalAdjective)
│   ├── CreateRoomButton → POST /api/rooms → navigate /room/:code
│   └── JoinRoomSection → GET /api/rooms/:code → navigate /room/:code
└── /room/:roomId  → RoomPage
    ├── RoomHeader      (code, share button, participant count)
    ├── WhiteboardShell (tldraw TldrawEditor + useSync)
    ├── ParticipantList (sidebar: name, color, host badge)
    └── ConnectionBanner (synced/reconnecting/disconnected)
```

## Key Data Flows

**Room creation**: Client POST `/api/rooms` → server generates 6-char code, creates TLSocketRoom, stores room metadata → returns `{ roomCode }` → client navigates to `/room/:code`, initiates WebSocket upgrade.

**Drawing sync**: User draws → tldraw Editor emits CRDT op → `useSync` sends op via WebSocket → TLSocketRoom broadcasts to all peers → each peer's tldraw store applies op. Cursors: throttled to 15fps, sent as presence messages.

**Host transfer**: Server tracks `connectedAt` per participant. On host disconnect → 30s timer → if host doesn't reconnect → promote oldest `connectedAt` participant → broadcast `hostChanged` event.

**localStorage flow**: `beforeunload` → force-save `wb:{code}:document` snapshot. On mount → server state loads (authoritative); localStorage as fallback only when server unreachable.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `client/` (Vite + React scaffold) | Create | SPA: landing page, room page, tldraw integration |
| `client/src/components/LandingPage.tsx` | Create | Hero card, name input, create/join actions |
| `client/src/components/RoomPage.tsx` | Create | Whiteboard shell, header, participant list |
| `client/src/hooks/useLocalStorage.ts` | Create | Auto-save debounce, restore, merge, quota check |
| `client/src/hooks/useAnonymousIdentity.ts` | Create | Generate, edit, persist AnimalAdjective name + color |
| `server/` (Express + ws scaffold) | Create | REST + WebSocket sync server |
| `server/src/rooms.ts` | Create | Room CRUD, TLSocketRoom factory, host management |
| `server/src/sync.ts` | Create | WebSocket upgrade handler, sync relay |
| `shared/types.ts` | Create | Room, Participant, ClientMessage, ServerMessage types |

## Interfaces

```typescript
// shared/types.ts
type RoomCode = string; // 5-6 uppercase alphanumeric
type ParticipantRole = "HOST" | "PARTICIPANT";

interface Participant {
  id: string;       // UUID (client-generated)
  name: string;     // "CuriousPenguin"
  color: string;    // hex
  role: ParticipantRole;
  connectedAt: number;
}

interface CreateRoomResponse { roomCode: RoomCode; }
interface RoomStatus { exists: boolean; participantCount: number; }
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | Room code generation, name generator, localStorage hooks | Vitest + React Testing Library |
| Integration | WebSocket sync (TLSocketRoom with 2 mock clients) | Vitest + ws mock |
| E2E | Happy path: create → join → draw → host transfer | Playwright (Vercel preview + Railway staging) |

## Deployment

- **Vercel**: Static SPA, env: `VITE_SYNC_SERVER=wss://{railway-url}`. No serverless functions.
- **Railway**: Express server, env: `PORT=8080`, `SQLITE_PATH=/data/rooms.db` (optional). Start: `node dist/server.js`.
- **Dev**: Vite proxy `"/api"` → `localhost:8080`, `"/ws"` → `ws://localhost:8080`.

## Migration / Rollout

No migration required. Greenfield deploy. Rollback: redeploy previous Vercel/Railway commits.

## Open Questions

- [ ] 15fps cursor throttle: confirm adequate at 10 users with high-latency connections
- [ ] SQLite `better-sqlite3` on Railway: verify native addon compatibility in free tier
