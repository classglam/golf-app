import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { ClubType, ViewAngle } from "@golf-coach/shared-types";
import { api, uploadFileToUrl } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { extractCheckpoints, type CheckpointPreview } from "../lib/pose";

const CLUB_OPTIONS: [ClubType, string][] = [
  ["driver", "Driver"],
  ["wood", "Madera"],
  ["hybrid", "Híbrido"],
  ["iron", "Hierro"],
  ["wedge", "Wedge"],
  ["putter", "Putter"],
];

const VIEW_OPTIONS: [ViewAngle, string][] = [
  ["face_on", "De cara"],
  ["down_the_line", "Desde atrás"],
  ["other", "Otro"],
];

const CHECKPOINT_LABEL: Record<CheckpointPreview["name"], string> = {
  address: "Posición inicial",
  top_of_backswing: "Cima del backswing",
  impact: "Impacto",
  follow_through: "Final",
};

export function UploadPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [clubType, setClubType] = useState<ClubType | "">("");
  const [viewAngle, setViewAngle] = useState<ViewAngle | "">("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previews, setPreviews] = useState<CheckpointPreview[]>([]);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !token) return;

    const extension = file.name.toLowerCase().endsWith(".mov") ? "mov" : "mp4";
    setError(null);
    setPreviews([]);
    setBusy(true);
    try {
      // 1. Pose estimation runs locally, in the browser, on WebAssembly.
      const { checkpoints, previews } = await extractCheckpoints(file, setStatus);
      setPreviews(previews);
      if (!previews.some((p) => p.poseDetected)) {
        throw new Error(
          "No hemos detectado a ninguna persona en el vídeo. Asegúrate de que se te ve de cuerpo entero."
        );
      }

      // 2. The video itself still goes to storage, same as the mobile app.
      setStatus("Solicitando URL de subida…");
      const { uploadUrl, storageKey } = await api.createUploadUrl(token, extension);
      setStatus("Subiendo vídeo…");
      await uploadFileToUrl(uploadUrl, file, `video/${extension}`);

      // 3. The API sends frames + metrics to Claude; no pose-worker involved.
      setStatus("Iniciando análisis…");
      const video = await api.createVideo(token, {
        storageKey,
        clubType: clubType || undefined,
        viewAngle: viewAngle || undefined,
        clientCheckpoints: checkpoints,
      });
      navigate(`/video/${video.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir el vídeo");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <h1>Subir swing</h1>
      <p className="muted">
        Sube un vídeo corto de tu swing (idealmente de cara o desde atrás, palo completo visible).
        La detección de postura se hace en tu navegador con WebAssembly.
      </p>

      <div className="row wrap">
        <label className="field">
          Palo
          <select value={clubType} onChange={(e) => setClubType(e.target.value as ClubType | "")} disabled={busy}>
            <option value="">Sin especificar</option>
            {CLUB_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Ángulo de cámara
          <select value={viewAngle} onChange={(e) => setViewAngle(e.target.value as ViewAngle | "")} disabled={busy}>
            <option value="">Sin especificar</option>
            {VIEW_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <label className={`primary button-link ${busy ? "disabled" : ""}`}>
        {busy ? "Procesando…" : "Elegir vídeo"}
        <input type="file" accept="video/mp4,video/quicktime" hidden disabled={busy} onChange={onFile} />
      </label>

      {status && <p className="muted center" aria-live="polite">{status}</p>}
      {error && <p className="error">{error}</p>}

      {previews.length > 0 && (
        <div className="grid">
          {previews.map((p) => (
            <figure key={p.name} className="card frame">
              <img src={p.previewDataUrl} alt={CHECKPOINT_LABEL[p.name]} />
              <figcaption>
                {CHECKPOINT_LABEL[p.name]} · {p.timestampSec.toFixed(2)}s
                {!p.poseDetected && <span className="error"> · sin pose</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
