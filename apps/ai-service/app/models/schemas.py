from pydantic import BaseModel

class EnrollRequest(BaseModel):
    event_id: str
    full_name: str
    email: str
    image_base64: str
class ProcessEventRequest(BaseModel):
    event_id: str