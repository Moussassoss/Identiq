from fastapi.responses import HTMLResponse
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from app.core.supabase_client import supabase
from app.core.config import PHOTO_BUCKET
import html

router = APIRouter()

def _signed_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    # Clean if bucket accidentally included
    if path.startswith(bucket + "/"):
        path = path[len(bucket) + 1:]
    res = supabase.storage.from_(bucket).create_signed_url(path, expires_in)
    signed = res.get("signedURL") or res.get("signed_url") or res.get("signedUrl")
    if not signed:
        raise RuntimeError(f"Could not sign {bucket}/{path}: {res}")
    return signed

@router.get("/gallery/{token}")
def gallery_json(token: str):
    tok = (
        supabase.table("gallery_tokens")
        .select("attendee_id, expires_at")
        .eq("token", token)
        .single()
        .execute()
        .data
    )
    if not tok:
        raise HTTPException(status_code=404, detail="Invalid token")

    expires_at = datetime.fromisoformat(tok["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=401, detail="Token expired")

    attendee_id = tok["attendee_id"]

    rows = (
        supabase.table("matches")
        .select("similarity, photos(storage_path)")
        .eq("attendee_id", attendee_id)
        .order("similarity", desc=True)
        .execute()
        .data
        or []
    )

    urls = []
    for r in rows:
        spath = r["photos"]["storage_path"]
        urls.append(_signed_url(PHOTO_BUCKET, spath, expires_in=3600))

    return {"count": len(urls), "photos": urls}

@router.get("/gallery-view/{token}", response_class=HTMLResponse)
def gallery_html(token: str):
    data = gallery_json(token)
    photos = data["photos"]

    imgs = "\n".join(
        f'<div style="margin:12px 0;"><img src="{html.escape(u)}" style="max-width:100%;border-radius:12px"/></div>'
        for u in photos
    )

    page = f"""
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Identiq Gallery</title>
      </head>
      <body style="font-family:Arial;padding:16px;max-width:900px;margin:auto;">
        <h2>Your Identiq Photos ({len(photos)})</h2>
        {imgs if imgs else "<p>No photos found.</p>"}
      </body>
    </html>
    """
    return HTMLResponse(content=page)