import json
import os
import uuid
from contextlib import contextmanager

import psycopg

DATABASE_URL = os.environ["DATABASE_URL"]


@contextmanager
def get_conn():
    conn = psycopg.connect(DATABASE_URL)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def update_video_status(video_id: str, status: str):
    with get_conn() as conn:
        conn.execute(
            'UPDATE videos SET status = %s WHERE id = %s', (status, video_id)
        )


def list_exercises():
    with get_conn() as conn:
        rows = conn.execute(
            'SELECT id, title, description, fault_tags FROM exercises'
        ).fetchall()
        return [
            {"id": r[0], "title": r[1], "description": r[2], "faultTags": r[3]}
            for r in rows
        ]


def save_metrics(video_id: str, joint_angles: dict, phase_timestamps: dict):
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO swing_metrics (id, video_id, joint_angles, phase_timestamps, created_at)
            VALUES (%s, %s, %s, %s, now())
            ON CONFLICT (video_id) DO UPDATE
            SET joint_angles = EXCLUDED.joint_angles,
                phase_timestamps = EXCLUDED.phase_timestamps
            """,
            (
                str(uuid.uuid4()),
                video_id,
                json.dumps(joint_angles),
                json.dumps(phase_timestamps),
            ),
        )


def save_analysis(
    video_id: str,
    summary_text: str,
    fault_tags: list[str],
    recommended_exercises: list[dict],
) -> str:
    analysis_id = str(uuid.uuid4())
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO swing_analyses (id, video_id, summary_text, fault_tags, created_at)
            VALUES (%s, %s, %s, %s, now())
            ON CONFLICT (video_id) DO UPDATE
            SET summary_text = EXCLUDED.summary_text,
                fault_tags = EXCLUDED.fault_tags
            """,
            (analysis_id, video_id, summary_text, fault_tags),
        )
        # Re-analysis reuses the existing row (upsert above); look up its real id
        # since analysis_id above is only correct on first insert.
        row = conn.execute(
            "SELECT id FROM swing_analyses WHERE video_id = %s", (video_id,)
        ).fetchone()
        real_analysis_id = row[0]
        conn.execute(
            "DELETE FROM analysis_exercises WHERE analysis_id = %s",
            (real_analysis_id,),
        )
        for rec in recommended_exercises:
            conn.execute(
                """
                INSERT INTO analysis_exercises (analysis_id, exercise_id, rank, reason)
                VALUES (%s, %s, %s, %s)
                """,
                (real_analysis_id, rec["exerciseId"], rec["rank"], rec["reason"]),
            )
    return analysis_id
