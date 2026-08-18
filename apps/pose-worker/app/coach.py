import json
import os

import anthropic

_client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
_model = os.environ.get("ANTHROPIC_MODEL", "claude-opus-5")

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "summary_text": {
            "type": "string",
            "description": "2-4 sentence coaching summary in the same language as the exercise library, written directly to the golfer.",
        },
        "fault_tags": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Short snake_case tags for the swing faults identified (e.g. over_the_top, early_extension).",
        },
        "recommended_exercises": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "exercise_id": {"type": "string"},
                    "rank": {"type": "integer"},
                    "reason": {
                        "type": "string",
                        "description": "One sentence on why this drill addresses this golfer's specific fault.",
                    },
                },
                "required": ["exercise_id", "rank", "reason"],
                "additionalProperties": False,
            },
            "description": "2-4 exercises chosen ONLY from the provided exercise library, ranked by priority (1 = most important).",
        },
    },
    "required": ["summary_text", "fault_tags", "recommended_exercises"],
    "additionalProperties": False,
}


def analyze_swing(checkpoints: dict, exercises: list[dict]) -> dict:
    exercise_catalog = "\n".join(
        f"- id={e['id']} | {e['title']} | tags={e['faultTags']} | {e['description']}"
        for e in exercises
    )

    content = [
        {
            "type": "text",
            "text": (
                "You are an experienced golf coach reviewing a student's swing from "
                "four checkpoint frames (address, top of backswing, impact, follow-through). "
                "For each frame you're given the frame image and pose-derived joint angles "
                "(shoulder/hip rotation and separation, spine angle from vertical, front knee flex). "
                "Diagnose the main 1-2 faults, then recommend 2-4 drills chosen ONLY from this "
                "exercise library, matching by fault tag where possible:\n\n"
                f"{exercise_catalog}\n\n"
                "Now here are the four checkpoint frames with their computed angles:"
            ),
        }
    ]

    for name, checkpoint in checkpoints.items():
        content.append(
            {
                "type": "text",
                "text": f"Checkpoint: {name} (t={checkpoint['timestampSec']}s)\nMetrics: {checkpoint['metrics']}",
            }
        )
        if checkpoint.get("frameJpegB64"):
            content.append(
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": checkpoint["frameJpegB64"],
                    },
                }
            )

    message = _client.messages.create(
        model=_model,
        max_tokens=4096,
        output_config={"format": {"type": "json_schema", "schema": RESPONSE_SCHEMA}},
        messages=[{"role": "user", "content": content}],
    )

    if message.stop_reason == "refusal":
        raise RuntimeError("Claude declined to analyze this swing video")

    text_block = next(b for b in message.content if b.type == "text")
    return json.loads(text_block.text)