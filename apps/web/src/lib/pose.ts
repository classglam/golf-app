/**
 * Browser port of apps/pose-worker/app/pose.py, running MediaPipe Pose
 * Landmarker on WebAssembly (with the GPU delegate when available).
 *
 * Same MVP heuristic as the Python worker: four checkpoints sampled at fixed
 * percentages of the clip, labelled address / top-of-backswing / impact /
 * follow-through. Metric formulas must stay identical to pose.py so analyses
 * from either path are comparable.
 */
import {
  DrawingUtils,
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import type {
  CheckpointName,
  PoseMetrics,
  SwingCheckpoints,
} from "@golf-coach/shared-types";

export const CHECKPOINTS: [CheckpointName, number][] = [
  ["address", 0.0],
  ["top_of_backswing", 0.3],
  ["impact", 0.55],
  ["follow_through", 0.85],
];

// pose.py falls back to 30fps when the container doesn't report one; the
// browser never exposes fps, so we use the same value to avoid seeking past
// the last frame.
const ASSUMED_FPS = 30;
// Long side of the frames sent to Claude, keeping the POST /videos body small.
const MAX_FRAME_SIDE = 1280;

const WASM_BASE = `${import.meta.env.BASE_URL}mediapipe/wasm`;
// "full" is the Tasks equivalent of model_complexity=1 used in pose.py.
const MODEL_URL =
  import.meta.env.VITE_POSE_MODEL_URL ??
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task";

// MediaPipe Pose landmark indices (same as mp.solutions.pose.PoseLandmark).
const LM = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  LEFT_ANKLE: 27,
} as const;

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

export function loadPoseLandmarker(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      const create = (delegate: "GPU" | "CPU") =>
        PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          runningMode: "IMAGE",
          numPoses: 1,
        });
      try {
        return await create("GPU");
      } catch {
        return await create("CPU");
      }
    })();
    landmarkerPromise.catch(() => {
      landmarkerPromise = null;
    });
  }
  return landmarkerPromise;
}

type Point = [number, number];

const round1 = (n: number) => Math.round(n * 10) / 10;
const degrees = (rad: number) => (rad * 180) / Math.PI;

/** Angle at point b (in degrees), formed by points a-b-c. */
function angle(a: Point, b: Point, c: Point): number | null {
  const ab: Point = [a[0] - b[0], a[1] - b[1]];
  const cb: Point = [c[0] - b[0], c[1] - b[1]];
  const dot = ab[0] * cb[0] + ab[1] * cb[1];
  const magAb = Math.hypot(...ab);
  const magCb = Math.hypot(...cb);
  if (magAb === 0 || magCb === 0) return null;
  const cos = Math.max(-1, Math.min(1, dot / (magAb * magCb)));
  return degrees(Math.acos(cos));
}

export function landmarkMetrics(landmarks: NormalizedLandmark[]): PoseMetrics {
  const pt = (i: number): Point => [landmarks[i].x, landmarks[i].y];

  const shoulderL = pt(LM.LEFT_SHOULDER);
  const shoulderR = pt(LM.RIGHT_SHOULDER);
  const hipL = pt(LM.LEFT_HIP);
  const hipR = pt(LM.RIGHT_HIP);
  const kneeL = pt(LM.LEFT_KNEE);
  const ankleL = pt(LM.LEFT_ANKLE);

  const shoulderLineAngle = degrees(
    Math.atan2(shoulderR[1] - shoulderL[1], shoulderR[0] - shoulderL[0])
  );
  const hipLineAngle = degrees(Math.atan2(hipR[1] - hipL[1], hipR[0] - hipL[0]));
  const shoulderMid: Point = [(shoulderL[0] + shoulderR[0]) / 2, (shoulderL[1] + shoulderR[1]) / 2];
  const hipMid: Point = [(hipL[0] + hipR[0]) / 2, (hipL[1] + hipR[1]) / 2];
  const spineAngleFromVertical = degrees(
    Math.atan2(shoulderMid[0] - hipMid[0], hipMid[1] - shoulderMid[1])
  );
  const frontKneeFlex = angle(hipL, kneeL, ankleL);

  return {
    shoulderLineAngleDeg: round1(shoulderLineAngle),
    hipLineAngleDeg: round1(hipLineAngle),
    shoulderHipSeparationDeg: round1(shoulderLineAngle - hipLineAngle),
    spineAngleFromVerticalDeg: round1(spineAngleFromVertical),
    // pose.py uses a truthiness check here, so 0° also maps to null.
    frontKneeFlexDeg: frontKneeFlex ? round1(frontKneeFlex) : null,
  };
}

export interface CheckpointPreview {
  name: CheckpointName;
  timestampSec: number;
  /** Frame with the detected skeleton drawn on top (for display only). */
  previewDataUrl: string;
  poseDetected: boolean;
}

export interface ExtractionResult {
  checkpoints: SwingCheckpoints;
  previews: CheckpointPreview[];
}

function loadVideo(file: File): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    video.onloadeddata = () => resolve(video);
    video.onerror = () =>
      reject(
        new Error(
          "Tu navegador no puede decodificar este vídeo. Prueba con un MP4 (H.264)."
        )
      );
  });
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    video.addEventListener("seeked", () => resolve(), { once: true });
    video.currentTime = time;
  });
}

/** Returns the four checkpoints in the same shape pose-worker produces. */
export async function extractCheckpoints(
  file: File,
  onProgress?: (message: string) => void
): Promise<ExtractionResult> {
  onProgress?.("Cargando el modelo de pose (WebAssembly)…");
  const landmarker = await loadPoseLandmarker();

  const video = await loadVideo(file);
  try {
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("No se pudo leer la duración del vídeo");
    }

    const scale = Math.min(1, MAX_FRAME_SIDE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");
    const drawing = new DrawingUtils(ctx);

    const lastFrameTime = Math.max(0, duration - 1 / ASSUMED_FPS);
    const checkpoints: SwingCheckpoints = {};
    const previews: CheckpointPreview[] = [];

    for (const [name, fraction] of CHECKPOINTS) {
      onProgress?.(`Analizando postura: ${name.replace(/_/g, " ")}…`);
      const time = Math.min(lastFrameTime, duration * fraction);
      await seek(video, time);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const result = landmarker.detect(canvas);
      const landmarks = result.landmarks[0];
      const metrics = landmarks ? landmarkMetrics(landmarks) : null;

      // Claude gets the clean frame, as in pose.py; the overlay is UI-only.
      const frameJpegB64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1] ?? null;

      if (landmarks) {
        drawing.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
          color: "#ffffff",
          lineWidth: 3,
        });
        drawing.drawLandmarks(landmarks, { color: "#1a7a3c", radius: 3 });
      }

      const timestampSec = Math.round(time * 1000) / 1000;
      checkpoints[name] = { timestampSec, metrics, frameJpegB64 };
      previews.push({
        name,
        timestampSec,
        previewDataUrl: canvas.toDataURL("image/jpeg", 0.7),
        poseDetected: Boolean(landmarks),
      });
    }

    return { checkpoints, previews };
  } finally {
    URL.revokeObjectURL(video.src);
  }
}
