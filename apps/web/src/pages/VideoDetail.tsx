import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { Video } from "@golf-coach/shared-types";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";

export function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [video, setVideo] = useState<Video | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    const poll = async () => {
      try {
        const v = await api.getVideo(token, id);
        if (cancelled) return;
        setVideo(v);
        if (v.status !== "processing" && interval) {
          clearInterval(interval);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar el análisis");
      }
    };

    poll();
    interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [token, id]);

  if (error) return <p className="error center">{error}</p>;
  if (!video || video.status === "processing" || video.status === "uploaded") {
    return (
      <div className="centered">
        <div className="spinner" aria-hidden />
        <p className="muted">Analizando tu swing, esto puede tardar un minuto…</p>
      </div>
    );
  }
  if (video.status === "failed" || !video.analysis) {
    return <p className="error center">No se pudo analizar este vídeo. Prueba a subirlo de nuevo.</p>;
  }

  const analysis = video.analysis;
  return (
    <div className="stack">
      <h1>Análisis</h1>
      <p className="summary">{analysis.summaryText}</p>

      <div className="row wrap">
        {analysis.faultTags.map((tag) => (
          <span key={tag} className="tag">{tag.replace(/_/g, " ")}</span>
        ))}
      </div>

      <h2>Ejercicios recomendados</h2>
      {analysis.recommendedExercises.map((rec) => (
        <article key={rec.exercise.id} className="card">
          <h3>{rec.rank}. {rec.exercise.title}</h3>
          <p>{rec.exercise.description}</p>
          <p className="reason">{rec.reason}</p>
        </article>
      ))}
    </div>
  );
}
