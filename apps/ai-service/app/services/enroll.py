from fastapi import APIRouter
from app.models.schemas import EnrollRequest
from app.core.supabase_client import supabase
from app.core.config import SELFIE_BUCKET
import base64
import uuid
import numpy as np
from deepface import DeepFace
from PIL import Image
import io

router = APIRouter()

@router.post("/enroll-attendee")
async def enroll_attendee(data: EnrollRequest):

    # decode base64 image
    image_bytes = base64.b64decode(data.image_base64)
    image = Image.open(io.BytesIO(image_bytes))

    # convert to numpy
    img_array = np.array(image)

    # generate embedding
    embedding = DeepFace.represent(
        img_array,
        model_name="ArcFace",
        enforce_detection=False
    )[0]["embedding"]

    # upload selfie
    file_name = f"{uuid.uuid4()}.jpg"

    supabase.storage.from_(SELFIE_BUCKET).upload(
        file_name,
        image_bytes
    )

    # save attendee
    supabase.table("attendees").insert({
        "event_id": data.event_id,
        "full_name": data.full_name,
        "email": data.email,
        "selfie_path": file_name,
        "embedding": embedding
    }).execute()

    return {"status": "success"}