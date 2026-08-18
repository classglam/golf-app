"""Pose extraction and swing-checkpoint metrics using MediaPipe.

MVP heuristic: instead of true swing-phase detection (which needs club
tracking or a trained phase classifier), we sample four checkpoints at fixed
percentages of the clip and label them address / top-of-backswing / impact /
follow-through. This is good enough to give Claude a consistent set of
frames + angles to reason about, and is the natural place to plug in a real
phase detector later without touching the rest of the pipeline.
"""

import base64
import math

import cv2
import mediapipe as mp

CHECKPOINTS = {
    "address": 0.0,
    "top_of_backswing": 0.30,
    "impact": 0.55,
    "follow_through": 0.85,
}

mp_pose = mp.solutions.pose


def _angle(a, b, c):
    """Angle at point b (in degrees), formed by points a-b-c."""
    ab = (a[0] - b[0], a[1] - b[1])
    cb = (c[0] - b[0], c[1] - b[1])
    dot = ab[0] * cb[0] + ab[1] * cb[1]
    mag_ab = math.hypot(*ab)
    mag_cb = math.hypot(*cb)
    if mag_ab == 0 or mag_cb == 0:
        return None
    cos_angle = max(-1.0, min(1.0, dot / (mag_ab * mag_cb)))
    return math.degrees(math.acos(cos_angle))


def _landmark_metrics(landmarks):
    lm = mp_pose.PoseLandmark
    pts = {name: (landmarks[name.value].x, landmarks[name.value].y) for name in lm}

    shoulder_l, shoulder_r = pts["LEFT_SHOULDER"], pts["RIGHT_SHOULDER"]
    hip_l, hip_r = pts["LEFT_HIP"], pts["RIGHT_HIP"]
    knee_l = pts["LEFT_KNEE"]
    ankle_l = pts["LEFT_ANKLE"]

    shoulder_line_angle = math.degrees(
        math.atan2(shoulder_r[1] - shoulder_l[1], shoulder_r[0] - shoulder_l[0])
    )
    hip_line_angle = math.degrees(
        math.atan2(hip_r[1] - hip_l[1], hip_r[0] - hip_l[0])
    )
    shoulder_mid = ((shoulder_l[0] + shoulder_r[0]) / 2, (shoulder_l[1] + shoulder_r[1]) / 2)
    hip_mid = ((hip_l[0] + hip_r[0]) / 2, (hip_l[1] + hip_r[1]) / 2)
    spine_angle_from_vertical = math.degrees(
        math.atan2(shoulder_mid[0] - hip_mid[0], hip_mid[1] - shoulder_mid[1])
    )
    front_knee_flex = _angle(hip_l, knee_l, ankle_l)

    return {
        "shoulderLineAngleDeg": round(shoulder_line_angle, 1),
        "hipLineAngleDeg": round(hip_line_angle, 1),
        "shoulderHipSeparationDeg": round(shoulder_line_angle - hip_line_angle, 1),
        "spineAngleFromVerticalDeg": round(spine_angle_from_vertical, 1),
        "frontKneeFlexDeg": round(front_knee_flex, 1) if front_knee_flex else None,
    }


def extract_checkpoints(video_path: str) -> dict:
    """Returns {checkpoint_name: {"timestampSec", "metrics", "frameJpegB64"}}."""
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if frame_count <= 0:
        raise ValueError("Could not read frame count from video")

    results = {}
    with mp_pose.Pose(static_image_mode=True, model_complexity=1) as pose:
        for name, fraction in CHECKPOINTS.items():
            frame_idx = min(frame_count - 1, int(frame_count * fraction))
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ok, frame = cap.read()
            if not ok:
                continue

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pose_result = pose.process(rgb)

            metrics = None
            if pose_result.pose_landmarks:
                metrics = _landmark_metrics(pose_result.pose_landmarks.landmark)

            ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            frame_b64 = base64.b64encode(buf.tobytes()).decode("ascii") if ok else None

            results[name] = {
                "timestampSec": round(frame_idx / fps, 3),
                "metrics": metrics,
                "frameJpegB64": frame_b64,
            }

    cap.release()
    return results
