"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) router.push("/dashboard");
      else router.push("/auth/login");
    })();
  }, [router]);

  return <div className="p-6">Loading...</div>;
}