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
