import os
import uuid
import requests
import numpy as np
import cv2
from datetime import datetime, timezone
from ultralytics import YOLO
from deepface import DeepFace

from app.core.supabase_client import supabase
from app.core.config import PHOTO_BUCKET, SIMILARITY_THRESHOLD

# IMPORTANT:
# You need a FACE detection weights file.
# Default we assume: "yolov8n-face.pt"
# Put it in: apps/ai-service/weights/yolov8n-face.pt
# (This is a common setup; there are open YOLOv8 face forks/models available.) :contentReference[oaicite:2]{index=2}
FACE_MODEL_PATH = os.getenv("FACE_MODEL_PATH", "weights/yolov8n-face.pt")

# Load YOLO once at startup
yolo_face = YOLO(FACE_MODEL_PATH)

def _create_signed_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    res = supabase.storage.from_(bucket).create_signed_url(path, expires_in)
    # supabase-py returns dict-like with "signedURL" (varies by version)
    signed = res.get("signedURL") or res.get("signed_url") or res.get("signedUrl")
    if not signed:
        raise RuntimeError(f"Could not create signed URL for {bucket}/{path}: {res}")
    return signed

def _download_image(url: str) -> np.ndarray:
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    data = np.frombuffer(r.content, np.uint8)
    img = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if img is None:
        raise RuntimeError("Failed to decode image")
    return img

def _extract_embedding(face_bgr: np.ndarray) -> list[float]:
    # DeepFace expects RGB array typically
    face_rgb = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)
    rep = DeepFace.represent(face_rgb, model_name="ArcFace", enforce_detection=False)
    return rep[0]["embedding"]

def process_event(event_id: str) -> dict:
    # 1) Fetch photos for the event
    photos = supabase.table("photos").select("id, storage_path").eq("event_id", event_id).execute().data or []

    if not photos:
        return {"status": "ok", "message": "No photos found", "photos_processed": 0}

    detections_count = 0
    matches_count = 0

    for p in photos:
        photo_id = p["id"]
        storage_path = p["storage_path"]

        # 2) Signed URL download
        signed_url = _create_signed_url(PHOTO_BUCKET, storage_path, expires_in=3600)
        img = _download_image(signed_url)

        # 3) YOLO face detection
        # results[0].boxes.xyxy -> (x1,y1,x2,y2)
        results = yolo_face.predict(img, verbose=False)
        boxes = results[0].boxes

        if boxes is None or len(boxes) == 0:
            continue

        for b in boxes:
            x1, y1, x2, y2 = b.xyxy[0].tolist()
            x1, y1, x2, y2 = map(int, [x1, y1, x2, y2])

            # clip bounds
            h, w = img.shape[:2]
            x1 = max(0, min(x1, w - 1))
            x2 = max(0, min(x2, w - 1))
            y1 = max(0, min(y1, h - 1))
            y2 = max(0, min(y2, h - 1))
            if x2 <= x1 or y2 <= y1:
                continue

            face = img[y1:y2, x1:x2]

            # 4) Embedding
            emb = _extract_embedding(face)

            # 5) Store detection
            det_insert = supabase.table("detections").insert({
                "photo_id": photo_id,
                "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                "embedding": emb
            }).execute()

            detections_count += 1

            # 6) Match detection embedding to attendees (RPC using pgvector cosine)
            rpc_res = supabase.rpc("find_attendee_matches", {
                "p_event_id": event_id,
                "p_embedding": emb,
                "p_threshold": SIMILARITY_THRESHOLD,
                "p_limit": 10
            }).execute()

            candidates = rpc_res.data or []
            for c in candidates:
                attendee_id = c["attendee_id"]
                similarity = float(c["similarity"])

                # 7) Store match (unique prevents duplicates)
                supabase.table("matches").upsert({
                    "attendee_id": attendee_id,
                    "photo_id": photo_id,
                    "similarity": similarity
                }, on_conflict="attendee_id,photo_id").execute()
                matches_count += 1

        # mark photo processed
        supabase.table("photos").update({"processed_at": datetime.now(timezone.utc).isoformat()}).eq("id", photo_id).execute()

    return {
        "status": "ok",
        "photos_processed": len(photos),
        "detections": detections_count,
        "matches": matches_count
    }