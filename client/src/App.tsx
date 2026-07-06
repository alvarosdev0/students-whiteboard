import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LandingPage from "./components/LandingPage";
import RoomPage from "./components/RoomPage";

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
    element: <RoomPage />,
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
