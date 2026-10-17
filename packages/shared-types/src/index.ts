export type VideoStatus = "uploaded" | "processing" | "analyzed" | "failed";

export type ClubType =
  | "driver"
  | "wood"
  | "hybrid"
  | "iron"
  | "wedge"
  | "putter";

export type ViewAngle = "face_on" | "down_the_line" | "other";

export interface User {
  id: string;
  email: string;
  name: string;
  handicap: number | null;
  lat: number | null;
  lng: number | null;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Exercise {
  id: string;
  title: string;
  description: string;
  demoUrl: string | null;
  faultTags: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
}

export interface RecommendedExercise {
  exercise: Exercise;
  rank: number;
  reason: string;
}

export interface SwingAnalysis {
  id: string;
  summaryText: string;
  faultTags: string[];
  createdAt: string;
  recommendedExercises: RecommendedExercise[];
}

export interface Video {
  id: string;
  userId: string;
  status: VideoStatus;
  clubType: ClubType | null;
  viewAngle: ViewAngle | null;
  createdAt: string;
  analysis: SwingAnalysis | null;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  storageKey: string;
}

// Swing checkpoints and pose metrics. Produced either server-side by
// apps/pose-worker (Python + MediaPipe) or in the browser by apps/web
// (MediaPipe Tasks on WebAssembly) — both must emit this exact shape.
export type CheckpointName =
  | "address"
  | "top_of_backswing"
  | "impact"
  | "follow_through";

export interface PoseMetrics {
  shoulderLineAngleDeg: number;
  hipLineAngleDeg: number;
  shoulderHipSeparationDeg: number;
  spineAngleFromVerticalDeg: number;
  frontKneeFlexDeg: number | null;
}

export interface SwingCheckpoint {
  timestampSec: number;
  metrics: PoseMetrics | null;
  frameJpegB64: string | null;
}

export type SwingCheckpoints = Partial<Record<CheckpointName, SwingCheckpoint>>;

export interface CreateVideoRequest {
  storageKey: string;
  clubType?: ClubType;
  viewAngle?: ViewAngle;
  // When present, pose estimation already ran on the client (WebAssembly) and
  // the API skips the pose-worker, sending these straight to Claude.
  clientCheckpoints?: SwingCheckpoints;
}
