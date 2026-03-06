"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";

type EventRow = {
  id: string;
  title: string;
  event_date: string | null;
  location: string | null;
  status: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return router.push("/auth/login");

      // get org for current user
      const userId = data.session.user.id;
      const orgRes = await supabase
        .from("organizations")
        .select("id,name,created_at")
        .eq("owner_user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1);

      if (orgRes.error) return setErr(orgRes.error.message);

      let org = orgRes.data?.[0];

      // If no org exists, create one automatically
      if (!org) {
        const createOrg = await supabase
          .from("organizations")
          .insert({ owner_user_id: userId, name: "My Organization" })
          .select("id,name,created_at")
          .single();

        if (createOrg.error) return setErr(createOrg.error.message);
        org = createOrg.data;
      }

      setOrgId(org.id);

      const ev = await supabase
        .from("events")
        .select("id,title,event_date,location,status")
        .eq("organization_id", org.id)
        .order("created_at", { ascending: false });

      if (ev.error) return setErr(ev.error.message);
      setEvents(ev.data as any);
    })();
  }, [router]);

  async function createEvent() {
    if (!orgId) return;
    setErr(null);
    const res = await supabase.from("events").insert({
      organization_id: orgId,
      title,
      event_date: date || null,
      location: location || null,
      status: "active",
    }).select("id").single();

    if (res.error) return setErr(res.error.message);
    router.push(`/dashboard/events/${res.data.id}`);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">

        <h1 className="text-2xl font-bold">
          Dashboard
        </h1>

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

      {err && <p className="mt-4 text-red-600">{err}</p>}

      <div className="mt-6 grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="font-semiboldn text-zinc-950">Create event</h2>
          <div className="mt-3 space-y-3">
            <input className="w-full border rounded-xl p-3 text-zinc-950" placeholder="Event title" value={title}
                   onChange={(e) => setTitle(e.target.value)} />
            <input className="w-full border rounded-xl p-3 text-zinc-950" type="date" value={date}
                   onChange={(e) => setDate(e.target.value)} />
            <input className="w-full border rounded-xl p-3 text-zinc-950" placeholder="Location" value={location}
                   onChange={(e) => setLocation(e.target.value)} />
            <button onClick={createEvent} className="w-full rounded-xl bg-black text-white p-3 hover:bg-gray-800">
              Create
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="font-semibold text-zinc-950">Your events</h2>
          <div className="mt-3 space-y-2 text-black">
            {events.map((e) => (
              <button
                key={e.id}
                onClick={() => router.push(`/dashboard/events/${e.id}`)}
                className="w-full text-left border rounded-xl p-3 hover:bg-gray-500"
              >
                <div className="font-medium">{e.title}</div>
                <div className="text-sm text-zinc-950">
                  {e.event_date ?? "No date"} • {e.location ?? "No location"} • {e.status}
                </div>
              </button>
            ))}
            {events.length === 0 && <p className="text-sm text-zinc-950">No events yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}