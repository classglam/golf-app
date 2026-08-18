import type {
  Video,
  SwingAnalysis,
  AnalysisExercise,
  Exercise,
  User,
} from "@prisma/client";

export function serializeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    handicap: user.handicap,
    lat: user.lat,
    lng: user.lng,
    createdAt: user.createdAt.toISOString(),
  };
}

export function serializeExercise(exercise: Exercise) {
  return {
    id: exercise.id,
    title: exercise.title,
    description: exercise.description,
    demoUrl: exercise.demoUrl,
    faultTags: exercise.faultTags,
    difficulty: exercise.difficulty,
  };
}

type AnalysisWithExercises = SwingAnalysis & {
  recommendedExercises: (AnalysisExercise & { exercise: Exercise })[];
};

export function serializeAnalysis(analysis: AnalysisWithExercises) {
  return {
    id: analysis.id,
    summaryText: analysis.summaryText,
    faultTags: analysis.faultTags,
    createdAt: analysis.createdAt.toISOString(),
    recommendedExercises: analysis.recommendedExercises
      .sort((a, b) => a.rank - b.rank)
      .map((re) => ({
        exercise: serializeExercise(re.exercise),
        rank: re.rank,
        reason: re.reason,
      })),
  };
}

export function serializeVideo(
  video: Video & { analysis: AnalysisWithExercises | null }
) {
  return {
    id: video.id,
    userId: video.userId,
    status: video.status,
    clubType: video.clubType,
    viewAngle: video.viewAngle,
    createdAt: video.createdAt.toISOString(),
    analysis: video.analysis ? serializeAnalysis(video.analysis) : null,
  };
}
