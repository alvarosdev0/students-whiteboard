import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { createServer } from "node:http";

const PORT = Number(process.env.PORT) || 8080;

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// HTTP server (Express + ws upgrade)
const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    // TODO: route by room code (T-009)
    ws.send(JSON.stringify({ type: "echo", payload: data.toString() }));
  });
  ws.send(JSON.stringify({ type: "connected" }));
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
