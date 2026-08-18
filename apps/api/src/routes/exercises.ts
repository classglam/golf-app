import { Router } from "express";
import { prisma } from "../lib/prisma";
import { serializeExercise } from "../lib/serialize";

export const exercisesRouter = Router();

exercisesRouter.get("/", async (_req, res) => {
  const exercises = await prisma.exercise.findMany({ orderBy: { title: "asc" } });
  res.json(exercises.map(serializeExercise));
});
