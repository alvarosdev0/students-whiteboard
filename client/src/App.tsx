import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LandingPage from "./components/LandingPage";

// ─── Placeholder for /room/:roomId (implemented in PR 5) ──────────

function RoomPagePlaceholder() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,
        textAlign: "center" as const,
        padding: 24,
      }}
    >
      <div>
        <h2 style={{ fontSize: 20, color: "#374151", margin: 0 }}>
          Sala de colaboración
        </h2>
        <p style={{ fontSize: 15, color: "#6b7280", marginTop: 8 }}>
          Esta página estará disponible en una próxima actualización.
        </p>
      </div>
    </div>
  );
}

// ─── 404 ──────────────────────────────────────────────────────────

function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,
        textAlign: "center" as const,
        padding: 24,
      }}
    >
      <div>
        <h1
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: "#e5e7eb",
            margin: 0,
            lineHeight: 1,
          }}
        >
          404
        </h1>
        <p style={{ fontSize: 18, color: "#374151", marginTop: 8 }}>
          Página no encontrada
        </p>
        <a
          href="/"
          style={{
            display: "inline-block",
            marginTop: 16,
            padding: "10px 24px",
            borderRadius: 10,
            background: "#6366F1",
            color: "#fff",
            textDecoration: "none",
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          Volver al inicio
        </a>
      </div>
    </div>
  );
}

// ─── Router ───────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/room/:roomId",
    element: <RoomPagePlaceholder />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);

// ─── App ──────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
