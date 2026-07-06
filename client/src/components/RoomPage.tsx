import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useSync } from "@tldraw/sync";
import { Tldraw } from "tldraw";
import { useAnonymousIdentity } from "../hooks/useAnonymousIdentity";
import { useParticipants } from "../hooks/useParticipants";
import { myAssetStore } from "../assetStore";

const ROOM_TIMEOUT_MS = 5000;

// ─── Loading Screen ───────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={S.centeredScreen}>
      <div style={S.spinner} className="app-spinner" />
      <p style={S.statusLabel}>Conectando al servidor…</p>
    </div>
  );
}

// ─── Error Screen ─────────────────────────────────────────────────

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={S.centeredScreen}>
      <div style={{ textAlign: "center" as const }}>
        <p style={{ fontSize: 18, color: "#EF4444", margin: 0 }}>Error de conexión</p>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 8 }}>{message}</p>
        <button onClick={onRetry} style={S.retryButton}>Reintentar</button>
      </div>
    </div>
  );
}

// ─── Room Header ──────────────────────────────────────────────────

function RoomHeader({
  roomId, participantCount, isHost, name, onNameChange, onCopy,
}: {
  roomId: string; participantCount: number; isHost: boolean;
  name: string; onNameChange: (n: string) => void;
  onCopy: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const commit = () => {
    const t = draft.trim();
    if (t.length >= 2 && t.length <= 30) onNameChange(t);
    else setDraft(name);
    setEditing(false);
  };

  return (
    <div style={S.header}>
      <div style={S.headerLeft}>
        <span style={S.participantCount}>{participantCount} {participantCount === 1 ? "participante" : "participantes"}</span>
      </div>
      <div style={S.headerCenter}>
        {editing ? (
          <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
            onBlur={commit} onKeyDown={e => { if (e.key==="Enter") commit(); if (e.key==="Escape") { setDraft(name); setEditing(false); }}}
            style={S.nameInput} maxLength={30} />
        ) : (
          <button onClick={() => { setDraft(name); setEditing(true); }} style={S.nameDisplay} title="Clic para editar">{name}</button>
        )}
        {isHost && <span style={S.hostBadge} title="Anfitrión">👑 Host</span>}
      </div>
      <div style={S.headerRight}>
        <button onClick={onCopy} style={S.codeBadge} title="Copiar código">{roomId}</button>
      </div>
    </div>
  );
}

// ─── Connection Banner ────────────────────────────────────────────

function ConnectionBanner({ status }: {
  status: { kind: "loading" } | { kind: "synced-remote"; online: boolean } | { kind: "error" };
}) {
  const s = status.kind === "loading" ? { l:"Conectando…", b:"#F3F4F6", d:"#9CA3AF", t:"#6B7280" }
    : status.kind === "synced-remote" && status.online ? { l:"Conectado", b:"#ECFDF5", d:"#10B981", t:"#065F46" }
    : status.kind === "synced-remote" ? { l:"Reconectando…", b:"#FEF3C7", d:"#F59E0B", t:"#92400E" }
    : { l:"Desconectado", b:"#FEE2E2", d:"#EF4444", t:"#991B1B" };
  return (
    <div style={{ ...S.banner, backgroundColor: s.b }}>
      <span style={{ ...S.bannerDot, backgroundColor: s.d }} />
      <span style={{ color: s.t }}>{s.l}</span>
    </div>
  );
}

// ─── Participant List ─────────────────────────────────────────────

function ParticipantList({ participants, currentUserId }: {
  participants: { id: string; name: string; color: string; role: string }[];
  currentUserId: string;
}) {
  if (participants.length <= 1) return null;
  return (
    <div style={S.participantSidebar}>
      <div style={S.participantSidebarTitle}>Participantes</div>
      {participants.map(p => (
        <div key={p.id} style={{ ...S.participantRow, fontWeight: p.id === currentUserId ? 700 : 400 }}>
          <span style={{ ...S.participantDot, backgroundColor: p.color }} />
          <span style={S.participantName}>{p.name}{p.id === currentUserId ? " (tú)" : ""}</span>
          {p.role === "HOST" && <span style={S.participantHostChip}>Host</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────

function Toast({ msg }: { msg: string }) {
  return <div style={S.toast}>{msg}</div>;
}

// ─── Main Component ───────────────────────────────────────────────

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { id, name, color, setName } = useAnonymousIdentity();
  const [timedOut, setTimedOut] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { participants, hostId } = useParticipants(roomId!, { id, name, color });
  const isHost = hostId === id || (hostId === null && (location.state as any)?.isHost);

  const syncServer = import.meta.env.VITE_SYNC_SERVER || "ws://localhost:8080";
  const storeWithStatus = useSync({ uri: `${syncServer}/sync/${roomId}`, userInfo: { id, name, color }, assets: myAssetStore });

  // Timeout
  useEffect(() => {
    if (storeWithStatus.status !== "loading") return;
    const t = setTimeout(() => setTimedOut(true), ROOM_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [storeWithStatus.status]);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2000); };
  const copyCode = () => navigator.clipboard.writeText(roomId!).then(() => flash("¡Código copiado!"));

  // Timed out
  if (storeWithStatus.status === "loading" && timedOut) {
    return (
      <div style={S.centeredScreen}>
        <div style={{ textAlign: "center" as const, maxWidth: 360, fontFamily: "inherit" }}>
          <p style={{ fontSize: 48, margin: 0 }}>🔍</p>
          <h2 style={{ margin: "16px 0 0", fontWeight: 700 }}>Sala no encontrada</h2>
          <p style={{ color: "#6b7280", marginTop: 8, lineHeight: 1.6 }}>
            La sala <strong>{roomId}</strong> no existe o ya finalizó.<br />Creá una nueva para colaborar.
          </p>
          <button onClick={() => navigate("/")} style={S.retryButton}>Crear nueva sala</button>
        </div>
      </div>
    );
  }

  // Loading
  if (storeWithStatus.status === "loading") {
    return (
      <div style={S.container}>
        <ConnectionBanner status={{ kind: "loading" }} />
        <RoomHeader roomId={roomId!} participantCount={participants.length||1} isHost={isHost}
          name={name} onNameChange={setName} onCopy={copyCode} />
        <LoadingScreen />
        {toast && <Toast msg={toast} />}
      </div>
    );
  }

  // Error
  if (storeWithStatus.status === "error") {
    return (
      <div style={S.container}>
        <ConnectionBanner status={{ kind: "error" }} />
        <RoomHeader roomId={roomId!} participantCount={participants.length||1} isHost={isHost}
          name={name} onNameChange={setName} onCopy={copyCode} />
        <ErrorScreen message={storeWithStatus.error instanceof Error ? storeWithStatus.error.message : "No se pudo conectar."}
          onRetry={() => window.location.reload()} />
      </div>
    );
  }

  // Connected
  return (
    <div style={S.container}>
      <ConnectionBanner status={{ kind: "synced-remote", online: storeWithStatus.connectionStatus === "online" }} />
      <RoomHeader roomId={roomId!} participantCount={participants.length} isHost={isHost}
        name={name} onNameChange={setName} onCopy={copyCode} />
      <div style={S.mainArea}>
        <ParticipantList participants={participants} currentUserId={id} />
        <div style={S.canvas}><Tldraw store={storeWithStatus.store} /></div>
      </div>
      {toast && <Toast msg={toast} />}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  container: { display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden" },
  header: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 16px", borderBottom:"1px solid #E5E7EB", backgroundColor:"#FAFAFA", flexShrink:0, gap:12 },
  headerLeft: { display:"flex", alignItems:"center", gap:12 },
  headerCenter: { display:"flex", alignItems:"center", flex:1, justifyContent:"center" },
  headerRight: { display:"flex", alignItems:"center", gap:12 },
  codeBadge: { padding:"4px 12px", borderRadius:6, backgroundColor:"#6366F1", color:"#fff", fontWeight:700, fontSize:16, letterSpacing:2, border:"none", cursor:"pointer", fontFamily:"inherit" },
  participantCount: { fontSize:13, color:"#6B7280" },
  nameDisplay: { padding:"2px 10px", borderRadius:6, border:"1px solid transparent", fontSize:14, fontWeight:600, color:"#111827", cursor:"pointer", fontFamily:"inherit", background:"transparent" },
  nameInput: { padding:"2px 10px", borderRadius:6, border:"1px solid #6366F1", fontSize:14, fontWeight:600, color:"#111827", outline:"none", fontFamily:"inherit", width:180, textAlign:"center" as const },
  hostBadge: { padding:"4px 10px", borderRadius:6, backgroundColor:"#FEF3C7", fontSize:12, fontWeight:600, color:"#92400E" },
  shareButton: { padding:"6px 14px", borderRadius:8, backgroundColor:"#F3F4F6", border:"1px solid #D1D5DB", fontSize:13, fontWeight:500, cursor:"pointer", color:"#374151", fontFamily:"inherit" },
  mainArea: { display:"flex", flex:1, overflow:"hidden" },
  canvas: { flex:1, overflow:"hidden" },
  participantSidebar: { width:200, flexShrink:0, borderRight:"1px solid #E5E7EB", backgroundColor:"#F9FAFB", padding:"12px 0", overflowY:"auto" },
  participantSidebarTitle: { fontSize:11, fontWeight:600, color:"#9CA3AF", textTransform:"uppercase" as const, letterSpacing:1, padding:"0 14px 8px" },
  participantRow: { display:"flex", alignItems:"center", gap:8, padding:"6px 14px", fontSize:13, color:"#374151" },
  participantDot: { width:10, height:10, borderRadius:"50%", flexShrink:0 },
  participantName: { flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const },
  participantHostChip: { fontSize:10, fontWeight:600, color:"#92400E", backgroundColor:"#FEF3C7", padding:"1px 6px", borderRadius:4 },
  centeredScreen: { display:"flex", alignItems:"center", justifyContent:"center", flex:1, minHeight:"100vh" },
  spinner: { width:32, height:32, borderRadius:"50%", border:"3px solid #E5E7EB", borderTopColor:"#6366F1", marginRight:12 },
  statusLabel: { fontSize:15, color:"#6B7280" },
  retryButton: { marginTop:16, padding:"10px 24px", borderRadius:10, backgroundColor:"#6366F1", color:"#fff", border:"none", fontSize:15, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
  banner: { display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"6px 16px", fontSize:13, fontWeight:500, flexShrink:0 },
  bannerDot: { width:8, height:8, borderRadius:"50%", display:"inline-block" },
  darkToggle: { position:"fixed" as const, bottom:16, right:16, width:44, height:44, borderRadius:"50%", border:"1px solid #D1D5DB", background:"#fff", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, boxShadow:"0 2px 8px rgba(0,0,0,0.12)" },
  toast: { position:"fixed" as const, bottom:80, left:"50%", transform:"translateX(-50%)", background:"#1F2937", color:"#fff", padding:"10px 24px", borderRadius:10, fontSize:14, fontWeight:600, zIndex:9999, boxShadow:"0 4px 12px rgba(0,0,0,0.2)", animation:"toast-in 0.3s ease" },
};
