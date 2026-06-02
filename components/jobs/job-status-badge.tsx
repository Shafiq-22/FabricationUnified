import { Badge } from "@/components/ui/badge";
import { statusMeta } from "@/lib/types";

export function JobStatusBadge({
  status,
  showLabel = false,
}: {
  status: string | null | undefined;
  showLabel?: boolean;
}) {
  const m = statusMeta(status);
  return <Badge variant={m.badge}>{showLabel ? m.label : m.prefix}</Badge>;
}
