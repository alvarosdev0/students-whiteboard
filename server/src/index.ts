import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import { IncomingMessage } from "node:http";
import { createRoom, roomExists, getRoomStatus } from "./rooms.js";
import { handleSyncConnection, joinRoom, updateName, listParticipants } from "./sync.js";

const PORT = Number(process.env.PORT) || 8080;

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// REST endpoints
// ---------------------------------------------------------------------------

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// Create a new room
app.post("/api/rooms", (_req, res) => {
  try {
    const roomCode = createRoom();
    res.status(201).json({ roomCode });
  } catch (err) {
    console.error("Failed to create room:", err);
    res.status(500).json({ error: "Failed to create room" });
  }
});

// Check room status
app.get("/api/rooms/:code", (req, res) => {
  const { code } = req.params;
  const status = getRoomStatus(code.toUpperCase());
  res.json(status);
});

// Join a room (register participant)
app.post("/api/rooms/:code/join", (req, res) => {
  const code = req.params.code.toUpperCase();
  if (!roomExists(code)) return res.status(404).json({ error: "Room not found" });
  const { name, color } = req.body;
  if (!name || !color) return res.status(400).json({ error: "name and color required" });
  const { participant } = joinRoom(code, name, color);
  res.json({ participant });
});

// Update participant name
app.patch("/api/rooms/:code/name", (req, res) => {
  const code = req.params.code.toUpperCase();
  const { participantId, name } = req.body;
  if (!participantId || !name) return res.status(400).json({ error: "participantId and name required" });
  if (!updateName(code, participantId, name)) return res.status(404).json({ error: "Participant not found" });
  res.json({ ok: true });
});

// Get participants list
app.get("/api/rooms/:code/participants", (req, res) => {
  const code = req.params.code.toUpperCase();
  if (!roomExists(code)) return res.status(404).json({ error: "Room not found" });
  res.json(listParticipants(code));
});

// ---------------------------------------------------------------------------
// HTTP server + WebSocket upgrade
// ---------------------------------------------------------------------------

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Handle WebSocket upgrade manually so we can route by path
server.on("upgrade", (request: IncomingMessage, socket, head) => {
  const url = request.url ?? "";

  // Parse room code from path: /sync/:roomCode (before any query string)
  const match = url.match(/^\/sync\/([A-Z2-9]{5,7})/i);
  if (!match) {
    socket.destroy();
    return;
  }

  const roomCode = match[1].toUpperCase();

  // Reject if room doesn't exist
  if (!roomExists(roomCode)) {
    socket.write("HTTP/1.1 404 Room Not Found\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    // Extract sessionId from query params (sent by tldraw's useSync)
    const searchParams = new URL(url, `http://${request.headers.host}`)
      .searchParams;
    const sessionId = searchParams.get("sessionId") ?? "";

    handleSyncConnection(ws, roomCode, sessionId);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
