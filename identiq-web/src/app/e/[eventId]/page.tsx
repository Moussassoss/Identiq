"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AI_BASE_URL, postJSON } from "@/lib/api";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const result = reader.result as string; // data:image/...;base64,xxxx
      const base64 = result.split(",")[1]; // keep only pure base64
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

export default function AttendeeEnrollPage() {
  const params = useParams();
  const eventId = (params?.eventId as string) || ""; // folder is [eventId]

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return !!eventId && fullName.trim().length >= 2 && email.includes("@") && !!file;
  }, [eventId, fullName, email, file]);

  async function submit() {
    if (!canSubmit || !file) return;

    setBusy(true);
    setErr(null);
    setMsg(null);

    try {
      const base64 = await fileToBase64(file);

      await postJSON(`${AI_BASE_URL}/enroll-attendee`, {
        event_id: eventId,
        full_name: fullName.trim(),
        email: email.trim(),
        image_base64: base64,
      });

      setMsg("✅ Enrolled successfully! You will receive your photos by email later.");
      setFullName("");
      setEmail("");
      setFile(null);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to enroll");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-zinc-950 text-center">Identiq</h1>
        <p className="text-center text-gray-500 mt-2">
          Register your face to receive your event photos
        </p>

        <div className="mt-6 space-y-4">
          <input
            className="w-full border text-black border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-black"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <input
            className="w-full border text-black border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-black"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className="border text-black border-gray-300 rounded-lg p-3">
            <p className="text-sm font-medium">Selfie (required)</p>
            <p className="text-xs text-gray-500 mt-1">
              Take a clear selfie facing the camera.
            </p>

            <input
              type="file"
              accept="image/*"
              className="mt-3 block w-full text-sm text-gray-700 cursor-pointer"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />

            {file && (
              <p className="text-xs text-gray-600 mt-2 break-all">
                Selected: {file.name}
              </p>
            )}
          </div>

          {err && <p className="text-red-600 text-sm">{err}</p>}
          {msg && <p className="text-green-700 text-sm">{msg}</p>}

          <button
            onClick={submit}
            disabled={!canSubmit || busy}
            className="w-full bg-black text-white py-3 rounded-lg hover:bg-gray-800 transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? "Submitting..." : "Submit"}
          </button>

          <p className="text-xs text-gray-500 text-center">
            Your data is used only to deliver your photos for this event.
          </p>
        </div>
      </div>
    </div>
  );
}