// TypeScript port of apps/pose-worker/app/coach.py, used when pose estimation
// ran in the browser (apps/web) and the API calls Claude directly. Keep the
// prompt and response schema in sync with the Python version.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import type { SwingCheckpoints } from "@golf-coach/shared-types";

const client = new Anthropic();
const model = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

const CoachResponseSchema = z.object({
  summary_text: z
    .string()
    .describe(
      "2-4 sentence coaching summary in the same language as the exercise library, written directly to the golfer."
    ),
  fault_tags: z
    .array(z.string())
    .describe(
      "Short snake_case tags for the swing faults identified (e.g. over_the_top, early_extension)."
    ),
  recommended_exercises: z
    .array(
      z.object({
        exercise_id: z.string(),
        rank: z.number().int(),
        reason: z
          .string()
          .describe("One sentence on why this drill addresses this golfer's specific fault."),
      })
    )
    .describe(
      "2-4 exercises chosen ONLY from the provided exercise library, ranked by priority (1 = most important)."
    ),
});

export type CoachResponse = z.infer<typeof CoachResponseSchema>;

export interface CatalogExercise {
  id: string;
  title: string;
  description: string;
  faultTags: string[];
}

export async function analyzeSwing(
  checkpoints: SwingCheckpoints,
  exercises: CatalogExercise[]
): Promise<CoachResponse> {
  const exerciseCatalog = exercises
    .map((e) => `- id=${e.id} | ${e.title} | tags=${JSON.stringify(e.faultTags)} | ${e.description}`)
    .join("\n");

  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    {
      type: "text",
      text:
        "You are an experienced golf coach reviewing a student's swing from " +
        "four checkpoint frames (address, top of backswing, impact, follow-through). " +
        "For each frame you're given the frame image and pose-derived joint angles " +
        "(shoulder/hip rotation and separation, spine angle from vertical, front knee flex). " +
        "Diagnose the main 1-2 faults, then recommend 2-4 drills chosen ONLY from this " +
        "exercise library, matching by fault tag where possible:\n\n" +
        `${exerciseCatalog}\n\n` +
        "Now here are the four checkpoint frames with their computed angles:",
    },
  ];

  for (const [name, checkpoint] of Object.entries(checkpoints)) {
    if (!checkpoint) continue;
    content.push({
      type: "text",
      text: `Checkpoint: ${name} (t=${checkpoint.timestampSec}s)\nMetrics: ${JSON.stringify(checkpoint.metrics)}`,
    });
    if (checkpoint.frameJpegB64) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: checkpoint.frameJpegB64 },
      });
    }
  }

  const message = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { format: zodOutputFormat(CoachResponseSchema) },
    messages: [{ role: "user", content }],
  });

  if (message.stop_reason === "refusal") {
    throw new Error("Claude declined to analyze this swing video");
  }
  if (!message.parsed_output) {
    throw new Error(`Claude returned no parseable analysis (stop_reason=${message.stop_reason})`);
  }
  return message.parsed_output;
}
