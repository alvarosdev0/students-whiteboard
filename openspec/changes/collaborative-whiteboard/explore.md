# Exploration: Collaborative Student Whiteboard

> **Context**: Build an Excalidraw-like collaborative whiteboard for students.
> Host/participant model, real-time drawing, paste support, localStorage persistence.
> **Stack**: Next.js 14+ (TypeScript), PostgreSQL, Prisma ORM, WebSockets.

---

## 1. Drawing/Canvas Engine

### Candidates Compared

| Library | Bundle Size | React/Next.js | Drawing Tools | Paste/Images | Collab Built-In | Verdict |
|---------|------------|---------------|--------------|-------------|----------------|---------|
| **tldraw** ⭐ | ~3MB (gzipped ~800KB) | ✅ First-class React SDK (`<Tldraw />`) | ✅ Full shape system + tools | ✅ Native paste, drag-drop, images, clipboard | ✅ Via `@tldraw/sync` + `@tldraw/sync-core` | **WINNER** |
| Excalidraw | ~2.5MB | ✅ Dynamic import + SSR off | ✅ Shapes, freehand, arrows | ✅ Paste + image support | ❌ No built-in — DIY from Electron app source | No built-in collab |
| Fabric.js | ~500KB | ⚠️ Imperative API, needs wrapper | ✅ Canvas objects | ✅ Image support | ❌ Raw canvas, no collab layer | Too low-level |
| Rough.js + Canvas | ~5MB (Rough) + custom | ❌ Must build everything | ✅ Hand-drawn style | ❌ Manual | ❌ Custom | Too much work |
| React Flow | ~500KB | ✅ React-native | ❌ Flow/Node-based only | ❌ | ⚠️ Limited | Wrong paradigm |
| Custom SVG | N/A | ❌ Full framework needed | ❌ Build from scratch | ❌ | ❌ | Not viable |

### Recommendation: **tldraw v4**

**Why tldraw wins decisively:**

1. **Complete whiteboard SDK** — shapes, freehand, arrows, sticky notes, text, eraser, selection, zoom, pan. All work out of the box. No need to build drawing tools from scratch.

2. **First-class React/Next.js support** — `<Tldraw />` component, `useSync()` hook, `createTLStore`, `getSnapshot`/`loadSnapshot`. Dynamic import with `{ ssr: false }` works perfectly.

3. **Paste is handled natively** — images, URLs, text, clipboard. Use `acceptedImageMimeTypes`, `maxAssetSize`, `TLAssetStore` for custom asset upload.

4. **`@tldraw/sync`** provides `useSync({ uri: 'wss://...' })` — one hook to connect a whiteboard room to a server. The **host/participant model maps directly to room-based connection**.

5. **`@tldraw/sync-core`** provides `TLSocketRoom` for the server — room management, session handling, conflict resolution, and persistence hooks. This is the **single strongest reason to choose tldraw**: the hardest part of the project (real-time CRDT sync) is already built and maintained by the tldraw team.

6. **localStorage persistence** is straightforward:
   ```tsx
   // Save
   const { document, session } = getSnapshot(editor.store)
   localStorage.setItem('whiteboard', JSON.stringify({ document, session }))

   // Load
   const saved = localStorage.getItem('whiteboard')
   if (saved) loadSnapshot(editor.store, JSON.parse(saved))
   ```

7. **Active maintenance** — tldraw is actively developed (v4.x), has 5,500+ code snippets on Context7, and strong community adoption.

**Tradeoff to accept**: tldraw's bundle is ~800KB gzipped. This is the cost of a full whiteboard SDK. For reference, Excalidraw is similar. This is acceptable for a whiteboard app.

---

## 2. Real-Time Collaboration / WebSocket

### Candidates Compared

| Approach | Conflict Model | Host/Participant | Setup Complexity | Next.js Compat | Verdict |
|----------|---------------|-------------------|-----------------|----------------|---------|
| **`ws` + `@tldraw/sync-core`** ⭐ | tldraw's own CRDT | ✅ TLSocketRoom manages sessions + room state | Medium — custom Node server needed | Custom server (separate port) or embedded | **WINNER** |
| Socket.IO | None built-in (LWW or manual) | ✅ Rooms map to sessions | Medium — custom impl | Custom server or API routes | Overkill; tldraw's sync is better |
| Yjs + y-websocket | CRDT (proven) | ⚠️ y-websocket room system | Medium | Separate server | Redundant with tldraw's sync |
| PartyKit | PartyKit manages state | ✅ Durable Objects per room | Low (hosted) | Cloudflare Workers | Third-party lock-in |
| Liveblocks | Liveblocks Storage | ✅ Rooms + presence | Low (SDK) | ✅ Next.js SDK | Third-party lock-in + cost |
| Supabase Realtime | Broadcast (LWW) | ⚠️ Broadcast channels | Medium | ✅ Direct | No CRDT for drawing |

### Recommendation: **`ws` (native WebSocket) + `@tldraw/sync-core`**

**Architecture:**

```
┌─────────────────┐     WebSocket      ┌──────────────────────┐
│  Client A        │◄────────────────►│  Node.js Server        │
│  (Host)          │                   │                        │
│  <Tldraw>        │                   │  TLSocketRoom           │
│  useSync({uri})  │                   │  ┌──────────────────┐  │
└─────────────────┘                   │  │ Room: "ABC123"    │  │
                                       │  │ - Session: Host   │  │
┌─────────────────┐     WebSocket      │  │ - Session: P1     │  │
│  Client B        │◄────────────────►│  │ - Session: P2     │  │
│  (Participant)   │                   │  └──────────────────┘  │
│  <Tldraw>        │                   │                        │
│  useSync({uri})  │                   │  SQLiteSyncStorage     │
└─────────────────┘                   │  (per-room persistence)│
                                       └──────────────────────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │  PostgreSQL   │
                                       │  (auth, users,│
                                       │  room metadata)│
                                       └──────────────┘
```

**Why this wins:**

1. **Minimal dependencies** — `ws` (npm package) for the WebSocket server, `@tldraw/sync-core` for the tldraw protocol. No Socket.IO, no Yjs, no third-party service.

2. **tldraw handles the hard parts** — `TLSocketRoom` manages: applying remote changes, broadcasting to peers, persisting state, handling reconnections, and conflict resolution. We don't need to implement CRDT or OT.

3. **Host/Participant model fits naturally**:
   - Host creates a whiteboard → server creates a `TLSocketRoom` + generates room code
   - Participants connect via `wss://server/sync/{roomCode}`
   - Server tracks which session is the host via connection metadata
   - If host disconnects, server can transfer host role to another participant

4. **Persistence is pluggable** — `SQLiteSyncStorage` for quick disk persistence, with ability to also persist snapshots to PostgreSQL for the primary database.

5. **No third-party lock-in** — runs on any Node.js host.

**Host/Participant session flow:**

```
1. Student A clicks "Create Whiteboard"
   → POST /api/whiteboard { title: "Math Study" }
   → Server creates DB record, generates roomCode "MATH42"
   → Returns { roomCode: "MATH42", role: "HOST" }
   → Client connects via wss://server/sync/MATH42

2. Student A shares URL: /board/MATH42

3. Student B opens /board/MATH42
   → POST /api/whiteboard/join { roomCode: "MATH42" }
   → Server validates room exists, adds participant
   → Returns { roomCode: "MATH42", role: "PARTICIPANT" }
   → Client connects via wss://server/sync/MATH42

4. Server's WebSocket handler:
   - On connect: calls room.handleSocketConnect({ sessionId, socket, meta: { role } })
   - On message: `TLSocketRoom` handles broadcast internally
   - On disconnect: cleanup session, check if host left
```

---

## 3. Database Schema (PostgreSQL + Prisma)

### Entities

```prisma
enum ParticipantRole {
  HOST
  PARTICIPANT
}

model User {
  id          String   @id @default(cuid())
  name        String
  color       String   @default("#000000")  // cursor color in whiteboard
  createdAt   DateTime @default(now())

  whiteboards Whiteboard[]
  participations WhiteboardParticipant[]
}

model Whiteboard {
  id          String   @id @default(cuid())
  title       String   @default("Untitled Whiteboard")
  roomCode    String   @unique                 // short code for sharing (e.g. "MATH42")
  hostId      String
  host        User     @relation(fields: [hostId], references: [id])
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  participants  WhiteboardParticipant[]
  snapshots     WhiteboardSnapshot[]

  @@index([roomCode])
}

model WhiteboardParticipant {
  id          String   @id @default(cuid())
  whiteboardId String
  whiteboard  Whiteboard @relation(fields: [whiteboardId], references: [id], onDelete: Cascade)
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  role        ParticipantRole @default(PARTICIPANT)
  joinedAt    DateTime @default(now())

  @@unique([whiteboardId, userId])
  @@index([whiteboardId])
}

model WhiteboardSnapshot {
  id          String   @id @default(cuid())
  whiteboardId String
  whiteboard  Whiteboard @relation(fields: [whiteboardId], references: [id], onDelete: Cascade)
  data        Json                              // full tldraw store snapshot
  createdAt   DateTime @default(now())

  @@index([whiteboardId])
}
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Server-side persistence?** | **Yes — snapshots** | tldraw's `TLSocketRoom` + `SQLiteSyncStorage` handles real-time state. PostgreSQL stores periodic snapshots for recovery and cross-session access. |
| **Snapshot frequency** | On significant pauses or explicit save | Debounce 5 seconds after last edit change. Also snapshot on host disconnect. |
| **localStorage vs server** | localStorage is the **cache**, server is the **source of truth** for collab sessions | On connect: load server state. On disconnect: snapshot to localStorage for offline reference. |
| **Anonymous vs accounts** | **Anonymous sessions** with optional name | Students should be able to join with just a display name (no sign-up). Generate a UUID for anonymous users. If accounts are added later, link users. |
| **Room code format** | 5-6 alphanumeric uppercase | Room codes like "MATH42", "CHEM01". Short enough to share verbally in a classroom. |

### Session Management API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/whiteboard` | POST | Create whiteboard → returns `{ id, roomCode, role: "HOST" }` |
| `/api/whiteboard/join` | POST | Join existing → `{ roomCode }` → returns `{ id, roomCode, role: "PARTICIPANT" }` |
| `/api/whiteboard/[id]` | GET | Get whiteboard metadata + participant list |
| `/api/whiteboard/[id]/snapshot` | GET | Get latest server snapshot |
| `/api/whiteboard/[id]/snapshot` | POST | Save a snapshot |
| `wss://server/sync/[roomCode]` | WebSocket | Real-time collaboration connection |

---

## 4. localStorage Strategy

### What Gets Saved

| Item | Key | Size | Strategy |
|------|-----|------|----------|
| Whiteboard document snapshot | `wb:[roomCode]:document` | ~50-200 KB typical | Save on every significant change (debounced 2s) |
| Session state (user prefs) | `wb:[roomCode]:session` | ~1-5 KB | Save view position, tool selection, theme |
| Recent room codes | `wb:recent-rooms` | ~1 KB | Last 5 visited rooms for quick access |
| User identity | `wb:user` | ~0.5 KB | Anonymous userId + display name |

### localStorage Size

- **Browser limit**: ~5-10 MB per origin
- **Typical tldraw snapshot**: A whiteboard with ~100 elements (shapes, text, arrows) is usually **50-200 KB** of JSON
- **Safety margin**: Even with dozens of whiteboards cached, we're well under 5 MB
- **Monitoring**: Optionally check `navigator.storage.estimate()` and warn if approaching limits

### Syncing Strategy

```
CONNECT:
  1. Server state for [roomCode] is authoritative
  2. Load server snapshot → render whiteboard
  3. Overlay any unsaved local annotations (none for collab)
  4. Discard local snapshot for that room (stale now)

DISCONNECT:
  1. Save current document snapshot to localStorage
  2. So user can see "what I was working on" while offline
  3. UI badge: "Offline — changes saved locally"

RECONNECT:
  1. Server state wins for collaborative rooms
  2. Local snapshot kept as backup (not loaded)
  3. If server unreachable, offer "Load local snapshot"
```

**Conflict resolution** is handled by tldraw's CRDT layer inside `TLSocketRoom` — no manual last-write-wins needed. The `@tldraw/sync` client automatically merges remote changes.

---

## 5. Architecture Overview

### Pages / Routes

```
/                     → Home page (create or join whiteboard)
/board/[roomCode]      → Whiteboard editing page (the main canvas)
```

### Component Tree (High-Level)

```
App
├── HomePage
│   ├── CreateWhiteboardForm  (title input → POST /api/whiteboard)
│   └── JoinWhiteboardForm    (room code input → POST /api/whiteboard/join)
│
└── WhiteboardPage
    ├── WhiteboardHeader
    │   ├── RoomInfo           (room code display, copy link)
    │   ├── ParticipantList    (avatars of connected users)
    │   └── ShareButton        (copy invite URL)
    │
    ├── TldrawCanvas           (dynamically imported, SSR disabled)
    │   ├── <Tldraw store={store} />
    │   └── Custom toolbar extensions (optional)
    │
    └── UserProvider           (anonymous user context)
```

### Data Flow: Drawing Action Propagation

```
Student A draws rectangle:
  1. <Tldraw /> component captures the drawing action
  2. tldraw's internal store updates locally (optimistic)
  3. @tldraw/sync's useSync() detects store change
  4. Change serialized into tldraw protocol message
  5. WebSocket sends message to server: wss://server/sync/MATH42
  6. Server's TLSocketRoom receives message:
     a. Applies change to authoritative room state
     b. Broadcasts change to ALL OTHER connected clients in room
  7. Student B's @tldraw/sync client receives broadcast
  8. tldraw engine applies remote change to local store
  9. <Tldraw /> re-renders with the new rectangle visible

Total latency: ~10-50ms (local WebSocket)
```

### API Endpoints Summary

| Endpoint | Method | Handler | Purpose |
|----------|--------|---------|---------|
| `/api/whiteboard` | POST | Next.js API Route | Create whiteboard |
| `/api/whiteboard/join` | POST | Next.js API Route | Join whiteboard |
| `/api/whiteboard/[id]` | GET | Next.js API Route | Get whiteboard metadata |
| `/api/whiteboard/[id]/snapshot` | GET | Next.js API Route | Get latest snapshot |
| `/api/whiteboard/[id]/snapshot` | POST | Next.js API Route | Save snapshot |
| `/api/user` | POST | Next.js API Route | Create/sync anonymous user |
| `wss://server/sync/[roomCode]` | WS | Custom Node.js WS Server | Real-time tldraw sync |

### Server Architecture Decision

Two options for running the WebSocket server alongside Next.js:

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **A. Separate Node.js process** ⭐ | Clean separation, can scale independently, no Next.js middleware interference | Extra process to deploy, needs port coordination | **RECOMMENDED** for production |
| **B. Next.js custom server** | Single process, shared code | Loses serverless benefits, can't deploy on Vercel easily | OK for dev, not for prod |

**Recommendation: Option A** — a separate Node.js server (Express or plain http) running on a different port (e.g., 3001) that handles WebSocket connections. The Next.js app (port 3000) communicates via REST to the WS server for room metadata. This is the standard pattern.

---

## 6. Authentication / Identity

### Recommendation: **Anonymous sessions with display names**

```
User Flow:
  1. First visit → generate UUID (stored in localStorage)
  2. Prompt: "Enter your display name for this session"
  3. Store { id: uuid, name: "Alice", color: "#ff6b6b" }
  4. Pass userId + name to server on WebSocket connect
  5. Other participants see "Alice" with her cursor color
```

**Why anonymous:**

- Students need to join instantly in a classroom setting — no sign-up friction
- Teachers can share a link, and students join by entering their name
- The host/participant distinction is per-session, not per-account
- If user accounts are needed later (e.g., to save whiteboards across sessions), the user model already supports it — just add email/password

**Host identification:**

- The creator of the whiteboard is automatically the host
- Server stores this in `WhiteboardParticipant.role = HOST`
- Host can: kick participants, end session, transfer host role
- If host disconnects >30 seconds, server can auto-transfer host to the longest-connected participant

---

## Recommendations Summary

| Area | Winner | Why |
|------|--------|-----|
| **Drawing Engine** | **tldraw v4** | Complete SDK, React-native, sync built-in, paste/images, localStorage |
| **WebSocket** | **`ws` + `@tldraw/sync-core`** | tldraw's own CRDT protocol, TLSocketRoom, no third-party lock-in |
| **Database** | **PostgreSQL + Prisma** | Prescribed stack, clean schema with User/Whiteboard/Participant/Snapshot |
| **Persistence** | **localStorage (client) + PostgreSQL (server snaps)** | localStorage for UX, server for collaboration truth |
| **Architecture** | **Separate WS server + Next.js** | Clean separation, scalable, production-ready |
| **Auth** | **Anonymous + display name** | Zero friction for classroom, UUID-based, upgradable to accounts |

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **tldraw bundle size (~800KB gzipped)** | Medium | Acceptable for a whiteboard app. Dynamic import with SSR disabled. Consider code-splitting. |
| **WebSocket server state on crash** | Medium | `TLSocketRoom` + `SQLiteSyncStorage` persists room state to disk. PostgreSQL snapshots provide additional safety. |
| **Host disconnects unexpectedly** | Medium | Implement host transfer: after 30s timeout, promote longest-connected participant. |
| **localStorage and server state divergence** | Low | tldraw's CRDT handles merge. Server is always authoritative for collab rooms. |
| **Anonymous user collision** | Low | UUIDs are unique. Display names are not unique but that's acceptable for a classroom setting. |
| **WebSocket deployment complexity** | Low | Standard pattern — separate Node process with `ws`. Deployable on Railway, Render, Fly.io, or any VPS. |
| **tldraw API instability (v4)** | Low | tldraw v4 is stable. Pin version in package.json. |

---

## Ready for Proposal

**Yes.** All technology decisions are concrete, the architecture is clear, and the risks are manageable. Proceed to **sdd-propose** to formalize scope and approach.

### What the orchestrator should tell the user:

> The exploration is complete. We recommend **tldraw v4** for the whiteboard canvas (React-native SDK, built-in sync protocol), **native WebSockets + `@tldraw/sync-core`** for real-time collaboration (room-based, CRDT conflict resolution), and **Prisma + PostgreSQL** for the data layer (users, rooms, snapshots). The host/participant model is handled via room codes and connection metadata. Students join anonymously with a display name — no sign-up required. localStorage is used for offline caching and preferences; the server is authoritative for collaboration. The WebSocket server runs as a separate Node.js process alongside Next.js.
>
> Ready for the **Proposal** phase: formalize the change scope, approach, and rollback plan.
