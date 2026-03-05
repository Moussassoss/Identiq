"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const router = useRouter();

  async function register() {
    setErr(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw new Error(error.message);

      const userId = data.user?.id;
      if (!userId) throw new Error("User not created.");

      // Create profile
      const { error: pErr } = await supabase.from("profiles").upsert({
        id: userId,
        full_name: fullName,
        role: "organizer",
      });
      if (pErr) throw new Error(pErr.message);

      // Create org (1 org per user for MVP)
      const { error: oErr } = await supabase.from("organizations").insert({
        owner_user_id: userId,
        name: orgName || `${fullName}'s Org`,
      });
      if (oErr) throw new Error(oErr.message);

      router.push("/dashboard");
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-center">Identiq</h1>
        <p className="text-center text-gray-500 mt-2">
          Create your organizer account
        </p>

        <div className="mt-6 space-y-4">
          <input
            className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-black"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <input
            className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-black"
            placeholder="Organization name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
          />

          <input
            className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-black"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-black"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {err && <p className="text-red-500 text-sm">{err}</p>}

          <button
            onClick={register}
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-lg hover:bg-gray-800 transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Creating..." : "Create account"}
          </button>

          <button
            onClick={() => router.push("/auth/login")}
            className="w-full border border-gray-300 py-3 rounded-lg hover:bg-gray-100 transition cursor-pointer"
          >
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
}