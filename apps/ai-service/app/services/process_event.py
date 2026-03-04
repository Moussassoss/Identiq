from fastapi import APIRouter
from app.models.schemas import ProcessEventRequest
from app.services.detect_and_match import process_event

router = APIRouter()

@router.post("/process-event")
async def process_event_endpoint(data: ProcessEventRequest):
    result = process_event(data.event_id)
    return result