import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Video } from "@golf-coach/shared-types";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";

const STATUS_LABEL: Record<Video["status"], string> = {
  uploaded: "Subido",
  processing: "Analizando…",
  analyzed: "Analizado",
  failed: "Error",
};

export function HomePage() {
  const { token, user, signOut } = useAuth();
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api.listVideos(token).then(setVideos).catch((err) => {
      setError(err instanceof Error ? err.message : "Error al cargar tus swings");
    });
  }, [token]);

  return (
    <div className="stack">
      <div className="row between">
        <h1>Hola, {user?.name}</h1>
        <button className="link danger" onClick={signOut}>Salir</button>
      </div>

      <Link to="/upload" className="primary button-link">+ Subir swing</Link>

      {error && <p className="error">{error}</p>}
      {videos === null && !error && <p className="muted">Cargando…</p>}
      {videos?.length === 0 && <p className="muted center">Todavía no has subido ningún swing.</p>}
      {videos?.map((v) => (
        <Link key={v.id} to={`/video/${v.id}`} className="card list-item">
          <span className="title">Swing del {new Date(v.createdAt).toLocaleDateString()}</span>
          <span className={`status status-${v.status}`}>{STATUS_LABEL[v.status]}</span>
        </Link>
      ))}
    </div>
  );
}
