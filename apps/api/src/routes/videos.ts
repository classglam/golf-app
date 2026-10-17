import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { createUploadUrl } from "../lib/s3";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { serializeVideo } from "../lib/serialize";
import { runClientAnalysis } from "../lib/client-analysis";

export const videosRouter = Router();

videosRouter.use(requireAuth);

const uploadUrlSchema = z.object({
  extension: z.enum(["mp4", "mov"]),
});

videosRouter.post("/upload-url", async (req: AuthedRequest, res) => {
  const parsed = uploadUrlSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { uploadUrl, storageKey } = await createUploadUrl(
    req.userId!,
    parsed.data.extension
  );
  res.json({ uploadUrl, storageKey });
});

// Checkpoints computed in the browser by apps/web (MediaPipe on WebAssembly).
const checkpointSchema = z.object({
  timestampSec: z.number().nonnegative(),
  metrics: z
    .object({
      shoulderLineAngleDeg: z.number(),
      hipLineAngleDeg: z.number(),
      shoulderHipSeparationDeg: z.number(),
      spineAngleFromVerticalDeg: z.number(),
      frontKneeFlexDeg: z.number().nullable(),
    })
    .nullable(),
  frameJpegB64: z.string().max(4_000_000).nullable(),
});

const createVideoSchema = z.object({
  storageKey: z.string().min(1),
  clubType: z
    .enum(["driver", "wood", "hybrid", "iron", "wedge", "putter"])
    .optional(),
  viewAngle: z.enum(["face_on", "down_the_line", "other"]).optional(),
  clientCheckpoints: z
    .object({
      address: checkpointSchema,
      top_of_backswing: checkpointSchema,
      impact: checkpointSchema,
      follow_through: checkpointSchema,
    })
    .partial()
    .strict()
    .optional(),
});

videosRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createVideoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const video = await prisma.video.create({
    data: {
      userId: req.userId!,
      storageKey: parsed.data.storageKey,
      clubType: parsed.data.clubType,
      viewAngle: parsed.data.viewAngle,
      status: "processing",
    },
  });

  const analysis = parsed.data.clientCheckpoints
    ? runClientAnalysis(video.id, parsed.data.clientCheckpoints)
    : triggerAnalysis(video.id, video.storageKey);

  analysis.catch(async (err) => {
    console.error(`analysis failed for video ${video.id}`, err);
    await prisma.video.update({
      where: { id: video.id },
      data: { status: "failed" },
    });
  });

  const withAnalysis = await prisma.video.findUniqueOrThrow({
    where: { id: video.id },
    include: { analysis: { include: { recommendedExercises: { include: { exercise: true } } } } },
  });
  res.status(201).json(serializeVideo(withAnalysis));
});

async function triggerAnalysis(videoId: string, storageKey: string) {
  const workerUrl = process.env.POSE_WORKER_URL;
  const response = await fetch(`${workerUrl}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId, storageKey }),
  });
  if (!response.ok) {
    throw new Error(`pose-worker responded ${response.status}`);
  }
}

videosRouter.get("/", async (req: AuthedRequest, res) => {
  const videos = await prisma.video.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
    include: { analysis: { include: { recommendedExercises: { include: { exercise: true } } } } },
  });
  res.json(videos.map(serializeVideo));
});

videosRouter.get("/:id", async (req: AuthedRequest, res) => {
  const video = await prisma.video.findFirst({
    where: { id: req.params.id, userId: req.userId! },
    include: { analysis: { include: { recommendedExercises: { include: { exercise: true } } } } },
  });
  if (!video) {
    return res.status(404).json({ error: "Video not found" });
  }
  res.json(serializeVideo(video));
});
