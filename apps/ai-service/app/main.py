from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.services.enroll import router as enroll_router
from app.services.process_event import router as process_router
from app.services.send_event import router as send_router
from app.services.gallery import router as gallery_router

app = FastAPI(title="Identiq AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],   # includes OPTIONS
    allow_headers=["*"],
)

app.include_router(enroll_router)
app.include_router(process_router)
app.include_router(send_router)
app.include_router(gallery_router)

@app.get("/")
def root():
    return {"message": "Identiq AI Service Running"}