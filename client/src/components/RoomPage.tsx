// === RoomPage — Collaborative Whiteboard Room ===
// T-010: Room-level component integrating tldraw canvas with real-time sync.
// T-011: Participant management via second WebSocket + name editing.
//
// Architecture:
//   <RoomPage>
//     ├── <RoomHeader>     — room code, share button, participant count, name edit
//     ├── <ConnectionBanner> — synced/reconnecting/disconnected
//     ├── <ParticipantList> — sidebar with participant names/colors
//     ├── {host badge}     — crown icon if current user is host
//     └── <Tldraw>         — full whiteboard canvas via useSync
//
// Dependencies: useAnonymousIdentity (T-004), useParticipants (T-011),
//               useSync (@tldraw/sync), App.tsx router (T-007)

import { useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useSync } from "@tldraw/sync";
import { Tldraw } from "tldraw";
import { useAnonymousIdentity } from "../hooks/useAnonymousIdentity";
import { useParticipants } from "../hooks/useParticipants";
import { myAssetStore } from "../assetStore";

// ─── Loading Screen ───────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={styles.centeredScreen}>
      <div style={styles.spinner} className="app-spinner" />
      <p style={styles.statusLabel}>Conectando al servidor…</p>
    </div>
  );
}

// ─── Error Screen ─────────────────────────────────────────────────

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={styles.centeredScreen}>
      <div style={{ textAlign: "center" as const }}>
        <p style={{ fontSize: 18, color: "#EF4444", margin: 0 }}>
          Error de conexión
        </p>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 8 }}>
          {message}
        </p>
        <button onClick={onRetry} style={styles.retryButton}>
          Reintentar
        </button>
      </div>
    </div>
  );
}

// ─── Room Header — with inline name editing ───────────────────────

function RoomHeader({
  roomId,
  participantCount,
  isHost,
  name,
  onNameChange,
}: {
  roomId: string;
  participantCount: number;
  isHost: boolean;
  name: string;
  onNameChange: (name: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(name);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId).catch(() => {});
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
  };

  const commitName = () => {
    const trimmed = draftName.trim();
    if (trimmed.length >= 2 && trimmed.length <= 30) {
      onNameChange(trimmed);
    } else {
      // Reset to current name if invalid
      setDraftName(name);
    }
    setEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitName();
    if (e.key === "Escape") {
      setDraftName(name);
      setEditingName(false);
    }
  };

  return (
    <div style={styles.header}>
      <div style={styles.headerLeft}>
        {/* Room code (click to copy) */}
        <button onClick={handleCopyCode} style={styles.codeBadge} title="Copiar código">
          {roomId}
        </button>

        {/* Participant count */}
        <span style={styles.participantCount}>
          {participantCount} {participantCount === 1 ? "participante" : "participantes"}
        </span>
      </div>

      <div style={styles.headerCenter}>
        {/* Name display / inline edit */}
        {editingName ? (
          <input
            autoFocus
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitName}
            onKeyDown={handleNameKeyDown}
            style={styles.nameInput}
            maxLength={30}
          />
        ) : (
          <button
            onClick={() => {
              setDraftName(name);
              setEditingName(true);
            }}
            style={styles.nameDisplay}
            title="Haz clic para cambiar tu nombre"
          >
            {name}
          </button>
        )}
      </div>

      <div style={styles.headerRight}>
        {/* Host badge */}
        {isHost && (
          <span style={styles.hostBadge} title="Anfitrión">
            👑 Host
          </span>
        )}

        {/* Share button */}
        <button onClick={handleShare} style={styles.shareButton}>
          📋 Compartir sala
        </button>
      </div>
    </div>
  );
}

// ─── Connection Banner ────────────────────────────────────────────

function ConnectionBanner({
  status,
}: {
  status: { kind: "loading" } | { kind: "synced-remote"; online: boolean } | { kind: "error" };
}) {
  const state = getConnectionState(status);
  return (
    <div style={{ ...styles.banner, backgroundColor: state.bg }}>
      <span style={{ ...styles.bannerDot, backgroundColor: state.dot }} />
      <span style={{ color: state.text }}>{state.label}</span>
    </div>
  );
}

interface ConnectionState {
  label: string;
  bg: string;
  dot: string;
  text: string;
}

function getConnectionState(status: {
  kind: "loading";
} | {
  kind: "synced-remote";
  online: boolean;
} | {
  kind: "error";
}): ConnectionState {
  switch (status.kind) {
    case "loading":
      return {
        label: "Conectando…",
        bg: "#F3F4F6",
        dot: "#9CA3AF",
        text: "#6B7280",
      };
    case "synced-remote":
      return status.online
        ? {
            label: "Conectado",
            bg: "#ECFDF5",
            dot: "#10B981",
            text: "#065F46",
          }
        : {
            label: "Reconectando…",
            bg: "#FEF3C7",
            dot: "#F59E0B",
            text: "#92400E",
          };
    case "error":
      return {
        label: "Desconectado",
        bg: "#FEE2E2",
        dot: "#EF4444",
        text: "#991B1B",
      };
  }
}

// ─── Participant List ─────────────────────────────────────────────

function ParticipantList({
  participants,
  currentUserId,
}: {
  participants: { id: string; name: string; color: string; role: string }[];
  currentUserId: string;
}) {
  if (participants.length <= 1) return null; // Only us — no need to show

  return (
    <div style={styles.participantSidebar}>
      <div style={styles.participantSidebarTitle}>Participantes</div>
      {participants.map((p) => (
        <div
          key={p.id}
          style={{
            ...styles.participantRow,
            fontWeight: p.id === currentUserId ? 700 : 400,
          }}
        >
          <span
            style={{
              ...styles.participantDot,
              backgroundColor: p.color,
            }}
          />
          <span style={styles.participantName}>
            {p.name}
            {p.id === currentUserId ? " (tú)" : ""}
          </span>
          {p.role === "HOST" && (
            <span style={styles.participantHostChip}>Host</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── RoomPage — Main Component ────────────────────────────────────

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  const { id, name, color, setName } = useAnonymousIdentity();

  // Second WebSocket for custom protocol (join/leave/nameChange/hostChange).
  // The server's handleSyncConnection handles both TLSocketRoom CRDT sync
  // AND custom JSON messages on the same endpoint — we just connect twice.
  const { participants, hostId } = useParticipants(roomId!, { id, name, color });

  // Host detection: now server-driven via hostId from custom protocol.
  // Navigation state is a fallback for the brief window before roomState arrives.
  const navIsHost = (location.state as { isHost?: boolean })?.isHost ?? false;
  const isHost = hostId === id || (hostId === null && navIsHost);

  // Build sync server URI.
  // Dev: direct ws://localhost:8080.  Prod: VITE_SYNC_SERVER env var.
  const syncServer = import.meta.env.VITE_SYNC_SERVER || "ws://localhost:8080";
  const uri = `${syncServer}/sync/${roomId}`;

  const storeWithStatus = useSync({
    uri,
    userInfo: { id, name, color },
    assets: myAssetStore,
  });

  // Loading state - canvas still loading, but participants may already be received
  if (storeWithStatus.status === "loading") {
    return (
      <div style={styles.container}>
        <ConnectionBanner status={{ kind: "loading" }} />
        <RoomHeader
          roomId={roomId!}
          participantCount={participants.length || 1}
          isHost={isHost}
          name={name}
          onNameChange={setName}
        />
        <LoadingScreen />
      </div>
    );
  }

  // Error state
  if (storeWithStatus.status === "error") {
    return (
      <div style={styles.container}>
        <ConnectionBanner status={{ kind: "error" }} />
        <RoomHeader
          roomId={roomId!}
          participantCount={participants.length || 1}
          isHost={isHost}
          name={name}
          onNameChange={setName}
        />
        <ErrorScreen
          message={
            storeWithStatus.error instanceof Error
              ? storeWithStatus.error.message
              : "No se pudo conectar al servidor de sincronización."
          }
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  // Synced-remote — canvas is ready with real-time sync
  return (
    <div style={styles.container}>
      <ConnectionBanner
        status={{
          kind: "synced-remote",
          online: storeWithStatus.connectionStatus === "online",
        }}
      />
      <RoomHeader
        roomId={roomId!}
        participantCount={participants.length}
        isHost={isHost}
        name={name}
        onNameChange={setName}
      />
      <div style={styles.mainArea}>
        <ParticipantList participants={participants} currentUserId={id} />
        <div style={styles.canvas}>
          <Tldraw store={storeWithStatus.store} />
        </div>
      </div>
    </div>
  );
}

// ─── Inline Styles ────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 16px",
    borderBottom: "1px solid #E5E7EB",
    backgroundColor: "#FAFAFA",
    flexShrink: 0,
    gap: 12,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  headerCenter: {
    display: "flex",
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  codeBadge: {
    padding: "4px 12px",
    borderRadius: 6,
    backgroundColor: "#6366F1",
    color: "#FFFFFF",
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: 2,
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  participantCount: {
    fontSize: 13,
    color: "#6B7280",
  },
  nameDisplay: {
    padding: "2px 10px",
    borderRadius: 6,
    backgroundColor: "transparent",
    border: "1px solid transparent",
    fontSize: 14,
    fontWeight: 600,
    color: "#111827",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "border-color 0.15s",
  },
  nameInput: {
    padding: "2px 10px",
    borderRadius: 6,
    border: "1px solid #6366F1",
    fontSize: 14,
    fontWeight: 600,
    color: "#111827",
    outline: "none",
    fontFamily: "inherit",
    width: 180,
    textAlign: "center" as const,
  },
  hostBadge: {
    padding: "4px 10px",
    borderRadius: 6,
    backgroundColor: "#FEF3C7",
    fontSize: 12,
    fontWeight: 600,
    color: "#92400E",
  },
  shareButton: {
    padding: "6px 14px",
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    border: "1px solid #D1D5DB",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    color: "#374151",
    fontFamily: "inherit",
  },
  // Participant sidebar
  mainArea: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  participantSidebar: {
    width: 200,
    flexShrink: 0,
    borderRight: "1px solid #E5E7EB",
    backgroundColor: "#F9FAFB",
    padding: "12px 0",
    overflowY: "auto",
  },
  participantSidebarTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: "#9CA3AF",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    padding: "0 14px 8px",
  },
  participantRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 14px",
    fontSize: 13,
    color: "#374151",
  },
  participantDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    flexShrink: 0,
  },
  participantName: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  participantHostChip: {
    fontSize: 10,
    fontWeight: 600,
    color: "#92400E",
    backgroundColor: "#FEF3C7",
    padding: "1px 6px",
    borderRadius: 4,
  },
  // Canvas
  canvas: {
    flex: 1,
    overflow: "hidden",
  },
  // Screens
  centeredScreen: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    minHeight: "calc(100vh - 100px)",
  },
  spinner: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: "3px solid #E5E7EB",
    borderTopColor: "#6366F1",
    marginRight: 12,
  },
  statusLabel: {
    fontSize: 15,
    color: "#6B7280",
  },
  retryButton: {
    marginTop: 16,
    padding: "8px 20px",
    borderRadius: 8,
    backgroundColor: "#6366F1",
    color: "#FFFFFF",
    border: "none",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  banner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "6px 16px",
    fontSize: 13,
    fontWeight: 500,
    flexShrink: 0,
  },
  bannerDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    display: "inline-block",
  },
};
