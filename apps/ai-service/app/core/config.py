import os
from dotenv import load_dotenv

load_dotenv()

SELFIE_BUCKET = os.getenv("SELFIE_BUCKET")
PHOTO_BUCKET = os.getenv("PHOTO_BUCKET")
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", 0.45))