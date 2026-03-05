import os
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException
import resend

from app.core.supabase_client import supabase

router = APIRouter()

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
APP_PUBLIC_URL = os.getenv("APP_PUBLIC_URL", "http://localhost:8000")
TOKEN_EXPIRY_HOURS = int(os.getenv("TOKEN_EXPIRY_HOURS", "168"))

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

@router.post("/send-event")
async def send_event(event_id: str):
    if not RESEND_API_KEY:
        raise HTTPException(status_code=500, detail="RESEND_API_KEY not set")

    # Get event title
    event = supabase.table("events").select("id,title").eq("id", event_id).single().execute().data
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Find attendees who have matches
    attendees = supabase.table("attendees").select("id,full_name,email").eq("event_id", event_id).execute().data or []

    sent = 0
    skipped = 0

    for a in attendees:
        attendee_id = a["id"]

        # Does this attendee have matches?
        m = supabase.table("matches").select("id").eq("attendee_id", attendee_id).limit(1).execute().data
        if not m:
            skipped += 1
            continue

        # Create token
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS)

        # Store token
        supabase.table("gallery_tokens").insert({
            "attendee_id": attendee_id,
            "token": token,
            "expires_at": expires_at.isoformat()
        }).execute()

        link = f"{APP_PUBLIC_URL}/gallery/{token}"

        # Send email
        subject = f"Your photos from {event['title']}"
        html = f"""
        <div style="font-family:Arial,sans-serif;">
          <h2>Hello {a['full_name']},</h2>
          <p>Your event photos are ready 🎉</p>
          <p><a href="{link}" style="padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">
            View your photos
          </a></p>
          <p>This link expires in {TOKEN_EXPIRY_HOURS//24} days.</p>
        </div>
        """

        resend.Emails.send({
            "from": "Identiq <cleanex@chadnova.com>",
            "to": [a["email"]],
            "subject": subject,
            "html": html
        })

        # Track job status (optional)
        supabase.table("email_jobs").upsert({
            "event_id": event_id,
            "attendee_id": attendee_id,
            "status": "sent",
            "sent_at": datetime.now(timezone.utc).isoformat()
        }, on_conflict="event_id,attendee_id").execute()

        sent += 1

    return {"status": "ok", "sent": sent, "skipped_no_matches": skipped}