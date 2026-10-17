import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { videosRouter } from "./routes/videos";
import { exercisesRouter } from "./routes/exercises";

const app = express();

app.use(cors());
// Raised from the 100kb default: POST /videos can carry 4 base64 JPEG frames
// when pose estimation ran in the browser (apps/web).
app.use(express.json({ limit: "15mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/videos", videosRouter);
app.use("/exercises", exercisesRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`api listening on http://localhost:${port}`);
});
