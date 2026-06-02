"use client";

import { createContext, useContext } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { SessionProfile } from "@/lib/types";

const ProfileContext = createContext<SessionProfile | null>(null);

/** Access the signed-in user's profile from any Client Component. */
export function useProfile(): SessionProfile {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within <Providers>");
  return ctx;
}

export function Providers({
  profile,
  children,
}: {
  profile: SessionProfile;
  children: React.ReactNode;
}) {
  return (
    <ProfileContext.Provider value={profile}>
      <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
    </ProfileContext.Provider>
  );
}
