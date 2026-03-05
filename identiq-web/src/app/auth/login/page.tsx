"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function login() {
    setErr(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return setErr(error.message);

    router.push("/dashboard");
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8">

        <h1 className="text-2xl font-bold text-center">
          Identiq
        </h1>

        <p className="text-center text-gray-500 mt-2">
          Login to your dashboard
        </p>

        <div className="mt-6 space-y-4">

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

          {err && (
            <p className="text-red-500 text-sm">{err}</p>
          )}

          <button
            onClick={login}
            className="w-full bg-black text-white py-3 rounded-lg hover:bg-gray-800 transition cursor-pointer"
          >
            Login
          </button>

          <button
            onClick={() => router.push("/auth/register")}
            className="w-full border border-gray-300 py-3 rounded-lg hover:bg-gray-100 transition cursor-pointer"
          >
            Create account
          </button>

        </div>
      </div>
    </div>
  );
}