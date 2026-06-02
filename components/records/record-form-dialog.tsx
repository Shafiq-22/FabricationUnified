"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/lib/hooks/use-toast";

export interface FieldDef {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "select";
  options?: { value: string; label: string }[];
  required?: boolean;
  step?: string;
  placeholder?: string;
  colSpan?: 1 | 2;
}

function buildInitial(fields: FieldDef[], initial?: Record<string, unknown>) {
  const v: Record<string, string> = {};
  fields.forEach((f) => {
    const raw = initial?.[f.key];
    v[f.key] = raw === null || raw === undefined ? "" : String(raw);
  });
  return v;
}

export function RecordFormDialog({
  trigger,
  title,
  fields,
  initial,
  onSubmit,
}: {
  trigger: React.ReactNode;
  title: string;
  fields: FieldDef[];
  initial?: Record<string, unknown>;
  onSubmit: (values: Record<string, string>) => Promise<{ error: string | null }>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    buildInitial(fields, initial),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (open) {
      setValues(buildInitial(fields, initial));
      setError(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await onSubmit(values);
      if (res.error) {
        setError(res.error);
      } else {
        setOpen(false);
        toast({ title: "Saved", description: title });
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <div
                key={f.key}
                className={`space-y-1.5 ${f.colSpan === 2 ? "col-span-2" : ""}`}
              >
                <Label htmlFor={f.key} className="text-xs">
                  {f.label}
                  {f.required && " *"}
                </Label>
                {f.type === "select" ? (
                  <Select value={values[f.key]} onValueChange={(v) => set(f.key, v)}>
                    <SelectTrigger id={f.key}>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(f.options ?? []).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={f.key}
                    type={f.type ?? "text"}
                    step={f.step}
                    required={f.required}
                    placeholder={f.placeholder}
                    value={values[f.key]}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
          {error && (
            <p className="flex items-center gap-2 border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
