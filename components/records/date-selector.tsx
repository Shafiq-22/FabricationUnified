"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

export function DateSelector({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <Input
      type="date"
      value={value}
      onChange={(e) => {
        const sp = new URLSearchParams(params.toString());
        sp.set("date", e.target.value);
        router.push(`${pathname}?${sp.toString()}`);
      }}
      className="h-8 w-44 text-xs"
    />
  );
}
