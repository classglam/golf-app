import type { ReactElement } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth-context";
import { LoginPage } from "./pages/Login";
import { RegisterPage } from "./pages/Register";
import { HomePage } from "./pages/Home";
import { UploadPage } from "./pages/Upload";
import { VideoDetailPage } from "./pages/VideoDetail";

function RequireAuth({ children }: { children: ReactElement }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/" replace />;
}

export function App() {
  const { token } = useAuth();
  return (
    <>
      <header className="topbar">
        <Link to={token ? "/home" : "/"} className="brand">
          Golf Coach
        </Link>
        <span className="badge">WebAssembly</span>
      </header>
      <main className="page">
        <Routes>
          <Route path="/" element={token ? <Navigate to="/home" replace /> : <LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/home" element={<RequireAuth><HomePage /></RequireAuth>} />
          <Route path="/upload" element={<RequireAuth><UploadPage /></RequireAuth>} />
          <Route path="/video/:id" element={<RequireAuth><VideoDetailPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
