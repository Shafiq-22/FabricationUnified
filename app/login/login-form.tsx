"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle, LogIn } from "lucide-react";
import { signIn, type SignInState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: SignInState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      <LogIn className="h-4 w-4" />
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export function LoginForm({ notice }: { notice?: string }) {
  const [state, formAction] = useFormState(signIn, initial);

  return (
    <form action={formAction} className="space-y-4">
      {notice && (
        <p className="flex items-center gap-2 border border-amber/40 bg-amber/10 px-3 py-2 text-xs text-amber">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {notice}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="name@company.com"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </div>
      {state.error && (
        <p className="flex items-center gap-2 border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {state.error}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
