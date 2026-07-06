// === RoomPage — Collaborative Whiteboard Room ===
// T-010: Room-level component integrating tldraw canvas with real-time sync.
//
// Architecture:
//   <RoomPage>
//     ├── <RoomHeader>     — room code, share button, participant count
//     ├── <ConnectionBanner> — synced/reconnecting/disconnected
//     ├── {host badge}     — crown icon if current user is host
//     └── <Tldraw>         — full whiteboard canvas via useSync
//
// Dependencies: useAnonymousIdentity (T-004), useSync (@tldraw/sync), App.tsx router (T-007)

import { useParams, useLocation } from "react-router-dom";
import { useSync } from "@tldraw/sync";
import { Tldraw } from "tldraw";
import { useAnonymousIdentity } from "../hooks/useAnonymousIdentity";
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

// ─── Room Header ──────────────────────────────────────────────────

function RoomHeader({
  roomId,
  participantCount,
  isHost,
}: {
  roomId: string;
  participantCount: number;
  isHost: boolean;
}) {
  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId).catch(() => {});
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).catch(() => {});
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

// ─── RoomPage — Main Component ────────────────────────────────────

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  const { id, name, color } = useAnonymousIdentity();

  // Host detection: derived from navigation state (LandingPage can pass isHost).
  // PR 6 will wire this from the server's roomState protocol message instead.
  const isHost = (location.state as { isHost?: boolean })?.isHost ?? false;

  // Participant count — initialized to 1 (ourselves).
  // PR 6 will wire this to the actual server participant list.
  const participantCount = 1;

  // Build sync server URI.
  // Dev: direct ws://localhost:8080.  Prod: VITE_SYNC_SERVER env var.
  const syncServer = import.meta.env.VITE_SYNC_SERVER || "ws://localhost:8080";
  const uri = `${syncServer}/sync/${roomId}`;

  const storeWithStatus = useSync({
    uri,
    userInfo: { id, name, color },
    assets: myAssetStore,
  });

  // Loading state
  if (storeWithStatus.status === "loading") {
    return (
      <div>
        <ConnectionBanner status={{ kind: "loading" }} />
        <RoomHeader roomId={roomId!} participantCount={participantCount} isHost={isHost} />
        <LoadingScreen />
      </div>
    );
  }

  // Error state
  if (storeWithStatus.status === "error") {
    return (
      <div>
        <ConnectionBanner status={{ kind: "error" }} />
        <RoomHeader roomId={roomId!} participantCount={participantCount} isHost={isHost} />
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
      <RoomHeader roomId={roomId!} participantCount={participantCount} isHost={isHost} />
      <div style={styles.canvas}>
        <Tldraw store={storeWithStatus.store} />
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
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
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
  canvas: {
    flex: 1,
    overflow: "hidden",
  },
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
