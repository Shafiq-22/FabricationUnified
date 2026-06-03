"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { useProfile } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { InactivityLogout } from "./inactivity-logout";

export function Topbar() {
  const profile = useProfile();

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4">
      <InactivityLogout />
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        Workshop&nbsp;·&nbsp;Steel&nbsp;Fabrication
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right leading-tight">
          <div className="text-sm font-medium">{profile.full_name}</div>
          <div className="font-mono text-[10px] uppercase tracking-wide text-amber">
            {profile.role_name}
          </div>
        </div>
        <form action={signOut}>
          <Button variant="ghost" size="icon" type="submit" title="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
