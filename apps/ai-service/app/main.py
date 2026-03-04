from fastapi import FastAPI
from app.services.enroll import router as enroll_router
from app.services.process_event import router as process_router
from app.services.send_event import router as send_router
from app.services.gallery import router as gallery_router

app = FastAPI(title="Identiq AI Service")

app.include_router(enroll_router)
app.include_router(process_router)
app.include_router(send_router)
app.include_router(gallery_router)

@app.get("/")
def root():
    return {"message": "Identiq AI Service Running"}