import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { createUploadUrl } from "../lib/s3";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { serializeVideo } from "../lib/serialize";

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

const createVideoSchema = z.object({
  storageKey: z.string().min(1),
  clubType: z
    .enum(["driver", "wood", "hybrid", "iron", "wedge", "putter"])
    .optional(),
  viewAngle: z.enum(["face_on", "down_the_line", "other"]).optional(),
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

  triggerAnalysis(video.id, video.storageKey).catch(async (err) => {
    console.error("pose-worker request failed", err);
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
