import { useState, useEffect } from "react";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LandingPage from "./components/LandingPage";
import RoomPage from "./components/RoomPage";

// ─── 404 ──────────────────────────────────────────────────────────

function NotFound() {
  return (
    <div style={S.centered}>
      <div style={{ textAlign: "center" as const }}>
        <h1 style={S.title404}>404</h1>
        <p style={S.text}>Página no encontrada</p>
        <a href="/" style={S.btn}>Volver al inicio</a>
      </div>
    </div>
  );
}

// ─── Router ───────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/room/:roomId", element: <RoomPage /> },
  { path: "*", element: <NotFound /> },
]);

// ─── App ──────────────────────────────────────────────────────────

export default function App() {
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <button onClick={() => setDark(!dark)} style={S.darkToggle} title={dark ? "Modo claro" : "Modo oscuro"}>
        {dark ? "☀️" : "🌙"}
      </button>
    </QueryClientProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  centered: { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"inherit" },
  title404: { fontSize:72, fontWeight:800, color:"#e5e7eb", margin:0, lineHeight:1 },
  text: { fontSize:18, color:"var(--text-secondary)", marginTop:8 },
  btn: { display:"inline-block", marginTop:16, padding:"10px 24px", borderRadius:10, background:"#6366F1", color:"#fff", textDecoration:"none", fontSize:15, fontWeight:600 },
  darkToggle: { position:"fixed" as const, bottom:16, right:16, width:44, height:44, borderRadius:"50%", border:"1px solid var(--border)", background:"var(--bg-card)", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, boxShadow:"0 2px 8px rgba(0,0,0,0.12)" },
};
