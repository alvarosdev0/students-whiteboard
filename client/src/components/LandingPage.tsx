import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { useAnonymousIdentity, generateRandomName } from "../hooks/useAnonymousIdentity";
import type { CreateRoomResponse, RoomStatus } from "@shared/types";

// ─── Inline styles ───────────────────────────────────────────────

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #f0f4ff 0%, #e8edf8 100%)",
    fontFamily: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,
    padding: 24,
  },
  card: {
    background: "#fff",
    borderRadius: 20,
    boxShadow: "0 8px 32px rgba(99, 102, 241, 0.12)",
    padding: "40px 36px",
    maxWidth: 420,
    width: "100%",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 20,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    lineHeight: 1,
  },
  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    color: "#1e1b4b",
    textAlign: "center" as const,
  },
  subtitle: {
    margin: 0,
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center" as const,
    lineHeight: 1.6,
  },
  nameSection: {
    width: "100%",
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  nameRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#f9fafb",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    padding: "2px 2px 2px 14px",
  },
  nameDisplay: {
    flex: 1,
    fontSize: 16,
    fontWeight: 500,
    color: "#1f2937",
    cursor: "pointer",
    padding: "6px 0",
    borderBottom: "2px dashed #d1d5db",
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: 500,
    color: "#1f2937",
    border: "none",
    outline: "none",
    background: "transparent",
    padding: "6px 0",
  },
  diceButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    border: "none",
    background: "#e0e7ff",
    cursor: "pointer",
    fontSize: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.15s",
    flexShrink: 0,
  },
  createButton: {
    width: "100%",
    padding: "14px 20px",
    borderRadius: 12,
    border: "none",
    background: "#6366F1",
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s, transform 0.1s",
  },
  divider: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: "#e5e7eb",
  },
  dividerText: {
    fontSize: 13,
    color: "#9ca3af",
    whiteSpace: "nowrap" as const,
  },
  joinSection: {
    width: "100%",
    display: "flex",
    gap: 8,
  },
  joinInput: {
    flex: 1,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    fontSize: 16,
    fontFamily: "monospace",
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
    outline: "none",
    transition: "border-color 0.15s",
  },
  joinButton: {
    padding: "10px 20px",
    borderRadius: 10,
    border: "none",
    background: "#10B981",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    transition: "background 0.15s",
  },
  error: {
    margin: 0,
    fontSize: 14,
    color: "#ef4444",
    fontWeight: 500,
  },
  footer: {
    marginTop: 32,
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center" as const,
  },
};

// ─── Component ───────────────────────────────────────────────────

export default function LandingPage() {
  const { name, setName } = useAnonymousIdentity();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Randomize name
  const handleRandomize = useCallback(() => {
    setName(generateRandomName());
  }, [setName]);

  // ── Inline editing
  const startEditing = useCallback(() => {
    setEditValue(name);
    setIsEditing(true);
  }, [name]);

  const saveEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed.length >= 2 && trimmed.length <= 30) {
      setName(trimmed);
    }
    setIsEditing(false);
  }, [editValue, setName]);

  // ── Create room
  const handleCreate = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      if (!res.ok) throw new Error("Server error");
      const data: CreateRoomResponse = await res.json();
      navigate(`/room/${data.roomCode}`);
    } catch {
      // Dev fallback: navigate with a random code so the UI works
      const fallbackCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      navigate(`/room/${fallbackCode}`);
    } finally {
      setCreating(false);
    }
  }, [navigate]);

  // ── Join room
  const handleJoin = useCallback(async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 5) return;

    setJoining(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${code}`);
      const data: RoomStatus = await res.json();
      if (res.ok && data.exists) {
        navigate(`/room/${code}`);
      } else {
        setError("Sala no encontrada o ha finalizado.");
      }
    } catch {
      // Dev fallback: navigate anyway
      navigate(`/room/${code}`);
    } finally {
      setJoining(false);
    }
  }, [joinCode, navigate]);

  const canJoin = joinCode.trim().length >= 5 && !joining;

  // ── Render
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Icon */}
        <div style={styles.icon}>✏️</div>

        {/* Title & Subtitle */}
        <h1 style={styles.title}>Pizarra Colaborativa</h1>
        <p style={styles.subtitle}>
          Dibuja, comparte y colabora en tiempo real con tus compañeros.
          Sin cuentas, sin complicaciones.
        </p>

        {/* Name section */}
        <div style={styles.nameSection}>
          <span style={styles.label}>Tu nombre</span>
          <div style={styles.nameRow}>
            {isEditing ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") setIsEditing(false);
                }}
                autoFocus
                maxLength={30}
                style={styles.nameInput}
              />
            ) : (
              <span
                onClick={startEditing}
                style={styles.nameDisplay}
                title="Haz clic para editar tu nombre"
              >
                {name}
              </span>
            )}
            <button
              onClick={handleRandomize}
              style={styles.diceButton}
              title="Generar nombre aleatorio"
              type="button"
            >
              🎲
            </button>
          </div>
        </div>

        {/* Create Room */}
        <button
          onClick={handleCreate}
          disabled={creating}
          style={{
            ...styles.createButton,
            opacity: creating ? 0.7 : 1,
            cursor: creating ? "default" : "pointer",
          }}
          type="button"
        >
          {creating ? "Creando sala..." : "Crear sala"}
        </button>

        {/* Divider */}
        <div style={styles.divider}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>o únete a una sala</span>
          <div style={styles.dividerLine} />
        </div>

        {/* Join Room */}
        <div style={styles.joinSection}>
          <input
            type="text"
            placeholder="Código de sala"
            value={joinCode}
            onChange={(e) =>
              setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))
            }
            maxLength={6}
            style={styles.joinInput}
            onKeyDown={(e) => e.key === "Enter" && canJoin && handleJoin()}
          />
          <button
            onClick={handleJoin}
            disabled={!canJoin}
            style={{
              ...styles.joinButton,
              opacity: canJoin ? 1 : 0.5,
              cursor: canJoin ? "pointer" : "default",
            }}
            type="button"
          >
            {joining ? "..." : "Unirse"}
          </button>
        </div>

        {/* Error */}
        {error && <p style={styles.error}>{error}</p>}
      </div>

      {/* Footer */}
      <footer style={styles.footer}>
        Sin registro &bull; Sin base de datos &bull; 100% gratuito
      </footer>
    </div>
  );
}
