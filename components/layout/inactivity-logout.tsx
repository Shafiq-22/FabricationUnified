"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MINUTES = Number(
  process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT_MINUTES ?? "480",
);

/**
 * Signs the user out after a period of inactivity (default 8 hours), per the
 * security requirement. JWTs auto-refresh, so idle logout must be explicit.
 */
export function InactivityLogout() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ms = Math.max(1, MINUTES) * 60_000;
    const supabase = createClient();

    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        await supabase.auth.signOut();
        router.push("/login?reason=inactive");
      }, ms);
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) =>
      window.addEventListener(e, reset, { passive: true }),
    );
    reset();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [router]);

  return null;
}
