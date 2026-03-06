"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseBrowser";
import { AI_BASE_URL, postJSON } from "@/lib/api";

const QRCodeCanvas = dynamic(
  () => import("qrcode.react").then((m) => m.QRCodeCanvas),
  { ssr: false }
);

type EventRow = {
  id: string;
  title: string;
  event_date: string | null;
  location: string | null;
  status: string;
  organization_id: string;
};

type PhotoRow = {
  id: string;
  storage_path: string;
  uploaded_at: string;
};

type AttendeeRow = {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
};

const BUCKET = "event-photos";

export default function EventDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = (params?.id as string) || "";

  const [origin, setOrigin] = useState("");
  const [event, setEvent] = useState<EventRow | null>(null);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [attendees, setAttendees] = useState<AttendeeRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function refreshPhotos() {
    const ph = await supabase
      .from("photos")
      .select("id,storage_path,uploaded_at")
      .eq("event_id", eventId)
      .order("uploaded_at", { ascending: false });

    if (!ph.error) setPhotos((ph.data as any) || []);
  }

  async function refreshAttendees() {
    const at = await supabase
      .from("attendees")
      .select("id,full_name,email,created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (!at.error) setAttendees((at.data as any) || []);
  }

  useEffect(() => {
    (async () => {
      setErr(null);
      setMsg(null);

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/auth/login");
        return;
      }

      if (!eventId) return;

      const ev = await supabase
        .from("events")
        .select("id,title,event_date,location,status,organization_id")
        .eq("id", eventId)
        .single();

      if (ev.error) {
        setErr(ev.error.message);
        setLoading(false);
        return;
      }
      setEvent(ev.data as EventRow);

      await refreshPhotos();
      await refreshAttendees();

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, router]);

  const attendeeLink = origin && eventId ? `${origin}/e/${eventId}` : "";

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!eventId) return;

    setBusy(true);
    setErr(null);
    setMsg(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Not authenticated");

      // Upload each file + insert DB row
      for (const file of Array.from(files)) {
        // Put photos in a folder per event
        const path = `events/${eventId}/${Date.now()}-${file.name}`;

        // 1) Upload to storage
        const up = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

        if (up.error) throw new Error(up.error.message);

        // 2) Insert into photos table (IMPORTANT: store ONLY the object path)
        const ins = await supabase.from("photos").insert({
          event_id: eventId,
          storage_path: path,
          uploaded_by: userId,
        });

        if (ins.error) throw new Error(ins.error.message);
      }

      setMsg(`Uploaded ✅ ${files.length} photo(s)`);
      await refreshPhotos();
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function processEvent() {
    if (!eventId) return;
    setErr(null);
    setMsg("Processing photos...");

    try {
      const res = await postJSON<any>(`${AI_BASE_URL}/process-event`, {
        event_id: eventId,
      });
      setMsg(
        `Done ✅ Photos: ${res.photos_processed}, detections: ${res.detections}, matches: ${res.matches}`
      );
    } catch (e: any) {
      setErr(e?.message ?? "Failed to process");
      setMsg(null);
    }
  }

  async function sendEmails() {
    if (!eventId) return;
    setErr(null);
    setMsg("Sending emails...");

    try {
      const r = await fetch(`${AI_BASE_URL}/send-event?event_id=${eventId}`, {
        method: "POST",
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setMsg(
        `Emails sent ✅ sent=${data.sent}, skipped(no matches)=${data.skipped_no_matches}`
      );
    } catch (e: any) {
      setErr(e?.message ?? "Failed to send emails");
      setMsg(null);
    }
  }

  async function signPhotoUrl(path: string) {
    // Signed URL for preview
    const res = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (res.error) return null;
    return res.data.signedUrl;
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <button
            className="text-sm text-gray-600 hover:underline"
            onClick={() => router.push("/dashboard")}
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold mt-1">{event?.title ?? "Event"}</h1>
          <p className="text-gray-600">
            {event?.event_date ?? "No date"} • {event?.location ?? "No location"} •{" "}
            {event?.status}
          </p>
        </div>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/auth/login");
          }}
          className="border px-4 py-2 rounded-lg hover:bg-gray-800 cursor-pointer transition"
        >
          Logout
        </button>
      </div>

      {(msg || err) && (
        <div
          className={`mt-4 rounded-xl p-4 ${
            err ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"
          }`}
        >
          {err ?? msg}
        </div>
      )}

      <div className="mt-6 grid lg:grid-cols-3 gap-6">
        {/* QR */}
        <div className="bg-white rounded-2xl text-black shadow p-5 lg:col-span-1">
          <h2 className="font-semibold">Attendee QR</h2>
          <p className="text-sm text-gray-600 mt-1">
            Attendees scan to enroll (name/email + selfie).
          </p>

          <div className="mt-4 flex items-center gap-4">
            {attendeeLink ? <QRCodeCanvas value={attendeeLink} size={140} /> : null}
            <div className="flex-1">
              <p className="text-sm font-medium">Link</p>
              <div className="mt-2 flex gap-2">
                <input className="w-full border rounded-lg p-2 text-sm" value={attendeeLink} readOnly />
                <button
                  className="border rounded-lg px-3 hover:bg-gray-100 cursor-pointer"
                  onClick={async () => {
                    await navigator.clipboard.writeText(attendeeLink);
                    setMsg("Copied ✅");
                  }}
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Upload */}
        <div className="bg-white rounded-2xl text-black shadow p-5 lg:col-span-1">
          <h2 className="font-semibold">Upload photos</h2>
          <p className="text-sm text-gray-600 mt-1">
            Upload event photos here. They will be stored in Supabase Storage.
          </p>

          <div className="mt-4">
            <input
              type="file"
              multiple
              accept="image/*"
              disabled={busy}
              onChange={(e) => uploadFiles(e.target.files)}
              className="block w-full text-sm text-gray-700
                         file:mr-4 file:py-2 file:px-4
                         file:rounded-lg file:border-0
                         file:text-sm file:font-semibold
                         file:bg-black file:text-white
                         hover:file:bg-gray-800
                         cursor-pointer"
            />
            {busy && <p className="text-sm text-gray-600 mt-2">Uploading...</p>}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-2xl text-black shadow p-5 lg:col-span-1">
          <h2 className="font-semibold">AI actions</h2>
          <p className="text-sm text-gray-600 mt-1">
            After uploading, process photos and send emails.
          </p>

          <div className="mt-4 space-y-3">
            <button
              onClick={processEvent}
              className="w-full bg-black text-white py-3 rounded-lg hover:bg-gray-800 transition cursor-pointer"
            >
              Process Photos
            </button>

            <button
              onClick={sendEmails}
              className="w-full border border-gray-300 py-3 rounded-lg hover:bg-gray-100 transition cursor-pointer"
            >
              Send Emails
            </button>
          </div>
        </div>
      </div>

      {/* Photos list */}
      <div className="mt-6 bg-white rounded-2xl shadow p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Uploaded photos</h2>
          <button
            className="text-sm border rounded-lg px-3 py-2 hover:bg-gray-100 cursor-pointer"
            onClick={refreshPhotos}
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {photos.map((p) => (
            <PhotoCard key={p.id} path={p.storage_path} signUrl={signPhotoUrl} />
          ))}
          {photos.length === 0 && (
            <p className="text-sm text-gray-600">No photos uploaded yet.</p>
          )}
        </div>
      </div>

      {/* Attendees list */}
      <div className="mt-6 bg-white rounded-2xl text-black shadow p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Attendees</h2>
          <button
            className="text-sm border rounded-lg px-3 py-2 hover:bg-gray-100 cursor-pointer"
            onClick={refreshAttendees}
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {attendees.map((a) => (
            <div key={a.id} className="border rounded-xl p-3">
              <div className="font-medium">{a.full_name}</div>
              <div className="text-sm text-gray-600">{a.email}</div>
            </div>
          ))}
          {attendees.length === 0 && (
            <p className="text-sm text-gray-600">No attendees yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PhotoCard({
  path,
  signUrl,
}: {
  path: string;
  signUrl: (path: string) => Promise<string | null>;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const u = await signUrl(path);
      setUrl(u);
    })();
  }, [path, signUrl]);

  return (
    <div className="border rounded-2xl overflow-hidden bg-gray-50">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="uploaded" className="w-full h-40 object-cover" />
      ) : (
        <div className="w-full h-40 flex items-center justify-center text-sm text-gray-500">
          Loading...
        </div>
      )}
      <div className="p-3">
        <p className="text-xs text-gray-600 break-all">{path}</p>
      </div>
    </div>
  );
}