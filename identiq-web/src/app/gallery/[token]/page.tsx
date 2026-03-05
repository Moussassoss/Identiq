"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AI_BASE_URL } from "@/lib/api";

export default function GalleryPage() {
  const params = useParams();
  const token = (params?.token as string) || "";

  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) return;

      setLoading(true);
      setErr(null);

      try {
        const res = await fetch(`${AI_BASE_URL}/gallery/${token}`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setPhotos(data.photos || []);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load gallery");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold">Your Photos</h1>
      <p className="text-gray-600 mt-1">
        These links may expire. If they do, refresh the page.
      </p>

      {loading && <p className="mt-6">Loading...</p>}
      {err && <p className="mt-6 text-red-600">{err}</p>}

      {!loading && !err && (
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {photos.map((url) => (
            <div key={url} className="bg-white rounded-2xl shadow overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="photo" className="w-full h-64 object-cover" />
            </div>
          ))}

          {photos.length === 0 && (
            <p className="text-gray-600">No photos found.</p>
          )}
        </div>
      )}
    </div>
  );
}