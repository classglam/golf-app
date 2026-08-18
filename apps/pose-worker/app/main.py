import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import BackgroundTasks, FastAPI
from pydantic import BaseModel

from . import db
from .coach import analyze_swing
from .pose import extract_checkpoints
from .storage import download_video

app = FastAPI()


class AnalyzeRequest(BaseModel):
    videoId: str
    storageKey: str


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/analyze", status_code=202)
def analyze(req: AnalyzeRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(_run_pipeline, req.videoId, req.storageKey)
    return {"accepted": True}


def _run_pipeline(video_id: str, storage_key: str):
    video_path = None
    try:
        video_path = download_video(storage_key)
        checkpoints = extract_checkpoints(video_path)

        joint_angles = {name: cp["metrics"] for name, cp in checkpoints.items()}
        phase_timestamps = {name: cp["timestampSec"] for name, cp in checkpoints.items()}
        db.save_metrics(video_id, joint_angles, phase_timestamps)

        exercises = db.list_exercises()
        result = analyze_swing(checkpoints, exercises)

        recommended = [
            {
                "exerciseId": item["exercise_id"],
                "rank": item["rank"],
                "reason": item["reason"],
            }
            for item in result["recommended_exercises"]
        ]
        db.save_analysis(
            video_id,
            result["summary_text"],
            result["fault_tags"],
            recommended,
        )
        db.update_video_status(video_id, "analyzed")
    except Exception as exc:  # noqa: BLE001 - top-level pipeline guard
        print(f"[pose-worker] analysis failed for video {video_id}: {exc}")
        db.update_video_status(video_id, "failed")
    finally:
        if video_path and os.path.exists(video_path):
            os.remove(video_path)
