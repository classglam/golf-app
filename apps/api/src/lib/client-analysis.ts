// In-process equivalent of apps/pose-worker/app/main.py::_run_pipeline for
// videos whose pose estimation already ran in the browser (WebAssembly).
// Writes the same rows the pose-worker writes, but through Prisma.
import type { Prisma } from "@prisma/client";
import type { SwingCheckpoints } from "@golf-coach/shared-types";
import { prisma } from "./prisma";
import { analyzeSwing } from "./coach";

export async function runClientAnalysis(videoId: string, checkpoints: SwingCheckpoints) {
  const entries = Object.entries(checkpoints).filter(([, cp]) => cp != null);
  const jointAngles = Object.fromEntries(
    entries.map(([name, cp]) => [name, cp!.metrics])
  ) as Prisma.InputJsonObject;
  const phaseTimestamps = Object.fromEntries(
    entries.map(([name, cp]) => [name, cp!.timestampSec])
  ) as Prisma.InputJsonObject;

  await prisma.swingMetrics.upsert({
    where: { videoId },
    create: { videoId, jointAngles, phaseTimestamps },
    update: { jointAngles, phaseTimestamps },
  });

  const exercises = await prisma.exercise.findMany({
    select: { id: true, title: true, description: true, faultTags: true },
  });
  const result = await analyzeSwing(checkpoints, exercises);

  // Structured output guarantees the shape, not that ids come from the catalog;
  // drop unknown ids so the analysis_exercises FK insert can't fail.
  const knownIds = new Set(exercises.map((e) => e.id));
  const recommended = result.recommended_exercises.filter((r) => knownIds.has(r.exercise_id));

  await prisma.$transaction(async (tx) => {
    const analysis = await tx.swingAnalysis.upsert({
      where: { videoId },
      create: { videoId, summaryText: result.summary_text, faultTags: result.fault_tags },
      update: { summaryText: result.summary_text, faultTags: result.fault_tags },
    });
    await tx.analysisExercise.deleteMany({ where: { analysisId: analysis.id } });
    await tx.analysisExercise.createMany({
      data: recommended.map((r) => ({
        analysisId: analysis.id,
        exerciseId: r.exercise_id,
        rank: r.rank,
        reason: r.reason,
      })),
      skipDuplicates: true,
    });
    await tx.video.update({ where: { id: videoId }, data: { status: "analyzed" } });
  });
}
