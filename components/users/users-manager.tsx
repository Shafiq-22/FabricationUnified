"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { inviteUser, setUserTier, setUserActive } from "@/app/(app)/users/actions";
import { RecordFormDialog, type FieldDef } from "@/components/records/record-form-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/lib/hooks/use-toast";
import type { UserProfile } from "@/lib/types";

export function UsersManager({
  users,
  roleNames,
  currentUserId,
}: {
  users: UserProfile[];
  roleNames: Record<number, string>;
  currentUserId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const roleOptions = [1, 2, 3].map((t) => ({
    value: String(t),
    label: roleNames[t] ?? `Tier ${t}`,
  }));

  const inviteFields: FieldDef[] = [
    { key: "full_name", label: "Full Name", required: true, colSpan: 2 },
    { key: "email", label: "Email", required: true, colSpan: 2 },
    { key: "password", label: "Temporary Password", required: true },
    { key: "tier", label: "Role", type: "select", options: roleOptions, required: true },
  ];

  const act = (fn: () => Promise<{ error: string | null }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res.error) toast({ variant: "destructive", title: "Failed", description: res.error });
      else {
        toast({ title: ok });
        router.refresh();
      }
    });

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-2">
        <p className="px-2 text-xs text-muted-foreground">
          Set a temporary password when inviting; the user can change it after first sign-in.
        </p>
        <RecordFormDialog
          title="Invite User"
          fields={inviteFields}
          onSubmit={inviteUser}
          trigger={
            <Button size="sm">
              <UserPlus className="h-4 w-4" /> Invite User
            </Button>
          }
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="w-52">Role</TableHead>
            <TableHead className="w-28">Status</TableHead>
            <TableHead className="w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="text-sm font-medium">
                {u.full_name}
                {u.id === currentUserId && (
                  <span className="ml-2 font-mono text-[10px] uppercase text-muted-foreground">
                    (you)
                  </span>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
              <TableCell>
                <Select
                  value={String(u.role_tier)}
                  disabled={pending}
                  onValueChange={(v) => act(() => setUserTier(u.id, Number(v)), "Role updated")}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                {u.active ? (
                  <Badge variant="com">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={pending}
                  onClick={() => act(() => setUserActive(u.id, !u.active), "Status updated")}
                >
                  {u.active ? "Deactivate" : "Activate"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
