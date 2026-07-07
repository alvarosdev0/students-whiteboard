# Pizarra Colaborativa para Estudiantes 🎨

Pizarra virtual en tiempo real al estilo Excalidraw, diseñada para **grupos de estudio (2–10 personas)**. Sin cuentas, sin registro, sin complicaciones.

> Creada con SDD (Spec-Driven Development) — 6 PRs encadenados, 12 tareas, ~1050 líneas. [Ver todos los PRs](https://github.com/alvarosdev0/students-whiteboard/pulls)

---

## Stack

| Capa | Tecnología | Deploy |
|------|-----------|--------|
| **Frontend** | Vite + React 18 + TypeScript + React Router v7 | [Vercel](https://vercel.com) (free) |
| **Canvas** | [tldraw](https://tldraw.dev) v3.15.6 + @tldraw/sync | — |
| **Sincronización** | @tldraw/sync-core (CRDT vía WebSocket) | [Railway](https://railway.app) (free) |
| **Participantes** | REST polling cada 3s | Mismo servidor Railway |
| **Persistencia cliente** | localStorage | — |
| **Sin base de datos** | Salas efímeras, sin PostgreSQL, sin Prisma | — |

---

## Cómo empezar

```bash
# 1. Clonar
git clone https://github.com/alvarosdev0/students-whiteboard.git
cd students-whiteboard

# 2. Servidor de sincronización
cd server
npm install
npx tsx src/index.ts
# → ws://localhost:8080

# 3. Cliente (otra terminal)
cd client
npm install
npm run dev
# → http://localhost:5173
```

Abrí `http://localhost:5173` en dos pestañas → creá una sala → colaborá.

---

## Arquitectura

```
Navegador (Vite SPA)
    │
    ├── REST ──► Railway (Express)
    │              ├── POST /api/rooms          → crear sala
    │              ├── GET  /api/rooms/:code      → validar
    │              ├── POST /api/rooms/:code/join  → unirse
    │              ├── PATCH /api/rooms/:code/name → cambiar nombre
    │              └── GET  /api/rooms/:code/participants → polling 3s
    │
    └── WebSocket ──► Railway (@tldraw/sync-core)
                       └── TLSocketRoom por sala
                           (CRDT, cursor presence, dibujos)
```

### Flujo de datos

| Acción | Cómo fluye |
|--------|-----------|
| **Dibujar** | tldraw → CRDT op → WebSocket → TLSocketRoom → broadcast a peers |
| **Crear sala** | POST /api/rooms → server genera código 6 chars → redirige |
| **Unirse** | POST /api/rooms/:code/join → se registra participante |
| **Nombres** | REST polling cada 3s → lista actualizada de participantes |
| **Host** | Primer en unirse = HOST. Si se desconecta 30s → transferencia |
| **Persistencia** | localStorage automático (cada cambio, debounced 500ms) |

---

## Estructura del proyecto

```
students-whiteboard/
├── client/                    # Vite + React SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── LandingPage.tsx    ← crear/unirse a sala
│   │   │   └── RoomPage.tsx       ← pizarra + participantes
│   │   ├── hooks/
│   │   │   ├── useAnonymousIdentity.ts  ← nombre Animal+Adjetivo
│   │   │   ├── useLocalStorage.ts       ← persistencia genérica
│   │   │   └── useParticipants.ts       ← polling de participantes
│   │   ├── assetStore.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
├── server/                    # Express + ws + @tldraw/sync-core
│   ├── src/
│   │   ├── index.ts              ← REST endpoints + WS upgrade
│   │   ├── rooms.ts              ← TLSocketRoom CRUD + host mgmt
│   │   └── sync.ts               ← WS handler + REST helpers
│   └── package.json
├── shared/
│   └── types.ts                ← Tipos compartidos (RoomCode, Participant, etc.)
├── openspec/                   ← Artefactos SDD (especificaciones, diseño, tareas)
├── design/
│   └── whiteboard-landing.pen  ← Mockup en OpenPencil
├── vercel.json
└── railway.json
```

---

## Características

| Funcionalidad | Estado |
|--------------|--------|
| ✏️ Dibujo libre, formas, texto, flechas | ✅ tldraw nativo |
| 📋 Pegar imágenes desde clipboard | ✅ |
| 👥 Multiplayer en tiempo real | ✅ CRDT vía WebSocket |
| 🎲 Nombres aleatorios (Animal+Adjetivo) | ✅ Persisten en localStorage |
| 📝 Nombre editable en sala | ✅ Click → editar → Enter |
| 👑 Host detection + transferencia | ✅ 30s timeout |
| ⏱️ Timeout sala inexistente (5s) | ✅ Redirige a crear sala |
| 🌙 Modo oscuro | ✅ Respeta sistema + toggle manual |
| 📋 Copiar código de sala | ✅ Click → toast |
| 💾 Persistencia local | ✅ Debounced 500ms |
| 📱 Diseño responsive | ✅ |

---

## PRs (feature-branch-chain)

Cada PR fue diseñado para revisión enfocada (~200 líneas):

| PR | Tareas | Contenido |
|----|--------|-----------|
| [#1](https://github.com/alvarosdev0/students-whiteboard/pull/1) | T-001..003 | Foundation: shared types, Vite scaffold, Express scaffold |
| [#2](https://github.com/alvarosdev0/students-whiteboard/pull/2) | T-004..005 | Hooks: anonymous identity + localStorage |
| [#3](https://github.com/alvarosdev0/students-whiteboard/pull/3) | T-006..007 | Landing Page + React Router |
| [#4](https://github.com/alvarosdev0/students-whiteboard/pull/4) | T-008..009 | Sync Server: rooms + TLSocketRoom |
| [#5](https://github.com/alvarosdev0/students-whiteboard/pull/5) | T-010 | Room Page + tldraw canvas |
| [#6](https://github.com/alvarosdev0/students-whiteboard/pull/6) | T-011..012 | Polish: dark mode, timeout, participantes, deploy |

---

## Deploy

### Frontend (Vercel)

```bash
cd client
npm run build
# → dist/ listo para deploy
```

### Servidor (Railway)

```bash
cd server
npm run build
node dist/index.js
# → Puerto 8080
```

Requiere `VITE_SYNC_SERVER=wss://tu-railway-url.railway.app` en producción.

---

## Licencia

MIT
