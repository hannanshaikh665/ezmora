import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  MoreHorizontal,
  ShieldCheck,
  UnlockKeyhole,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Empty, PageHeader, Panel } from "@/components/GlassBits";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import {
  changeMemberRole,
  createTeamMember,
  deleteMemberLogin,
  disableMemberLogin,
  listTeamMembers,
  lockMemberLogin,
  reactivateMemberLogin,
  resetMemberPassword,
  unlockMemberLogin,
} from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team & Logins — Ezmora Realty CRM" },
      {
        name: "description",
        content:
          "Owner controls for creating supervisor and sales logins, managing access, resetting passwords and reviewing the Ezmora Realty roster.",
      },
      { property: "og:title", content: "Team & Logins — Ezmora Realty CRM" },
      { property: "og:description", content: "Every login is created and owned by you." },
    ],
  }),
  component: TeamPage,
});

type ConfirmAction = {
  userId: string;
  name: string;
  action: "disable" | "delete";
} | null;

function TeamPage() {
  const queryClient = useQueryClient();
  const { isOwner } = useAuth();
  const addMember = useServerFn(createTeamMember);
  const resetPassword = useServerFn(resetMemberPassword);
  const listMembers = useServerFn(listTeamMembers);
  const lockLogin = useServerFn(lockMemberLogin);
  const unlockLogin = useServerFn(unlockMemberLogin);
  const disableLogin = useServerFn(disableMemberLogin);
  const reactivateLogin = useServerFn(reactivateMemberLogin);
  const deleteLogin = useServerFn(deleteMemberLogin);
  const changeRole = useServerFn(changeMemberRole);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    designation: "",
    branch: "",
    role: "employee" as "employee" | "supervisor",
  });
  const [resetValue, setResetValue] = useState<Record<string, string>>({});
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const { data: members } = useQuery({
    queryKey: ["team"],
    enabled: isOwner,
    queryFn: async () => listMembers(),
  });

  const refreshTeam = () => void queryClient.invalidateQueries({ queryKey: ["team"] });
  const notifySuccess = (message: string) => {
    toast.success(message);
    refreshTeam();
  };

  const create = useMutation({
    mutationFn: async () =>
      addMember({
        data: {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim() || undefined,
          designation: form.designation.trim() || undefined,
          branch: form.branch.trim() || undefined,
          role: form.role,
        },
      }),
    onSuccess: () => {
      toast.success("Login created");
      setForm({ ...form, fullName: "", email: "", password: "", phone: "" });
      refreshTeam();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reset = useMutation({
    mutationFn: async (args: { userId: string; password: string }) =>
      resetPassword({ data: args }),
    onSuccess: (_data, variables) => {
      toast.success("Password updated and audit logged");
      setResetValue((previous) => ({ ...previous, [variables.userId]: "" }));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const accessMutation = useMutation({
    mutationFn: async (args: { userId: string; action: "lock" | "unlock" | "reactivate" }) => {
      if (args.action === "lock") return lockLogin({ data: { userId: args.userId } });
      if (args.action === "unlock") return unlockLogin({ data: { userId: args.userId } });
      return reactivateLogin({ data: { userId: args.userId } });
    },
    onSuccess: (_data, variables) => {
      notifySuccess(
        variables.action === "lock"
          ? "Login locked and active sessions invalidated"
          : variables.action === "unlock"
            ? "Login unlocked"
            : "Account reactivated",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const roleMutation = useMutation({
    mutationFn: async (args: { userId: string; role: "employee" | "supervisor" }) =>
      changeRole({ data: args }),
    onSuccess: () => notifySuccess("Role changed and audit logged"),
    onError: (error: Error) => toast.error(error.message),
  });

  const confirmMutation = useMutation({
    mutationFn: async (args: { userId: string; action: "disable" | "delete" }) => {
      if (args.action === "disable") return disableLogin({ data: { userId: args.userId } });
      return deleteLogin({ data: { userId: args.userId } });
    },
    onSuccess: (_data, variables) => {
      setConfirmAction(null);
      notifySuccess(
        variables.action === "disable"
          ? "Account disabled; CRM history retained"
          : "Login access removed; CRM history retained",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader
        title="Team &amp; Logins"
        subtitle="Create supervisor and sales logins, set designations, reset passwords and manage access."
      />

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Create a login">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <div className="flex gap-2">
              {(["employee", "supervisor"] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, role }))}
                  className={`press flex-1 rounded-xl border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    form.role === role
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>

            <Field
              id="fullName"
              label="Full name"
              value={form.fullName}
              onChange={(v) => setForm((p) => ({ ...p, fullName: v }))}
              required
            />
            <Field
              id="email"
              label="Login ID (email)"
              type="email"
              value={form.email}
              onChange={(v) => setForm((p) => ({ ...p, email: v }))}
              required
            />
            <Field
              id="password"
              label="Temporary password"
              type="password"
              value={form.password}
              onChange={(v) => setForm((p) => ({ ...p, password: v }))}
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                id="phone"
                label="Phone"
                value={form.phone}
                onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
              />
              <Field
                id="designation"
                label="Designation"
                value={form.designation}
                onChange={(v) => setForm((p) => ({ ...p, designation: v }))}
              />
            </div>
            <Field
              id="branch"
              label="Branch"
              value={form.branch}
              onChange={(v) => setForm((p) => ({ ...p, branch: v }))}
            />

            <Button type="submit" className="press w-full" disabled={create.isPending}>
              <UserPlus className="size-4" /> Create login
            </Button>
          </form>
        </Panel>

        <Panel title="Roster">
          {(members ?? []).length === 0 ? (
            <Empty>No team members yet.</Empty>
          ) : (
            <ul className="space-y-3">
              {(members ?? []).map((member) => {
                const status = member.access_status || "active";
                const isManageable = member.role === "employee" || member.role === "supervisor";
                return (
                  <li key={member.id} className="rounded-xl border border-border/70 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{member.full_name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground">
                          {member.email} · {member.designation ?? "—"} · {member.branch ?? "—"}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Created {formatDate(member.authCreatedAt)} · Last login {formatDate(member.lastLoginAt)} · Last active {formatDate(member.lastActiveAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={status} />
                        <span className="rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-medium text-gold capitalize">
                          {member.role}
                        </span>
                        {isOwner && isManageable && (
                          <AccessMenu
                            member={member}
                            status={status}
                            onLock={() => accessMutation.mutate({ userId: member.id, action: "lock" })}
                            onUnlock={() => accessMutation.mutate({ userId: member.id, action: "unlock" })}
                            onReactivate={() => accessMutation.mutate({ userId: member.id, action: "reactivate" })}
                            onRoleChange={(role) => roleMutation.mutate({ userId: member.id, role })}
                            onDisable={() => setConfirmAction({ userId: member.id, name: member.full_name || "this user", action: "disable" })}
                            onDelete={() => setConfirmAction({ userId: member.id, name: member.full_name || "this user", action: "delete" })}
                          />
                        )}
                      </div>
                    </div>

                    {isManageable && status !== "login_removed" && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Input
                          type="password"
                          value={resetValue[member.id] ?? ""}
                          onChange={(e) =>
                            setResetValue((prev) => ({ ...prev, [member.id]: e.target.value }))
                          }
                          placeholder="New password"
                          minLength={8}
                          maxLength={72}
                          className="h-9 max-w-[220px]"
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          className="press"
                          disabled={reset.isPending}
                          onClick={() => {
                            const password = resetValue[member.id] ?? "";
                            if (password.length < 8) {
                              toast.error("Use at least 8 characters.");
                              return;
                            }
                            reset.mutate({ userId: member.id, password });
                          }}
                        >
                          <KeyRound className="size-4" /> Reset
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <AlertDialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              {confirmAction?.action === "disable" ? "Disable login access?" : "Remove login access?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === "disable"
                ? `Disable ${confirmAction.name}'s login? They will be unable to sign in until reactivated. All CRM records, leads, calls, follow-ups and history will be retained.`
                : `Remove ${confirmAction?.name}'s authentication login? Their login will be deleted, but all CRM records, leads, calls, follow-ups and history will be retained.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={confirmMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (confirmAction) confirmMutation.mutate(confirmAction);
              }}
            >
              {confirmAction?.action === "disable" ? "Disable login" : "Remove login"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AccessMenu({
  member,
  status,
  onLock,
  onUnlock,
  onReactivate,
  onRoleChange,
  onDisable,
  onDelete,
}: {
  member: { id: string; role: string };
  status: string;
  onLock: () => void;
  onUnlock: () => void;
  onReactivate: () => void;
  onRoleChange: (role: "employee" | "supervisor") => void;
  onDisable: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="size-8" aria-label="Manage access">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Manage access</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {status === "locked" ? (
          <DropdownMenuItem onSelect={onUnlock}>
            <UnlockKeyhole /> Unlock login
          </DropdownMenuItem>
        ) : status === "disabled" ? (
          <DropdownMenuItem onSelect={onReactivate}>
            <UserCheck /> Reactivate account
          </DropdownMenuItem>
        ) : status === "active" ? (
          <DropdownMenuItem onSelect={onLock}>
            <LockKeyhole /> Lock login
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={onDisable} disabled={status === "disabled" || status === "login_removed"}>
          <UserX /> Disable account
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Change role</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onRoleChange("employee")} disabled={member.role === "employee" || status === "login_removed"}>
          <UserCheck /> Make employee
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onRoleChange("supervisor")} disabled={member.role === "supervisor" || status === "login_removed"}>
          <ShieldCheck /> Make supervisor
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive" disabled={status === "login_removed"}>
          <UserX /> Remove login access
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status.replace("_", " ");
  const styles =
    status === "active"
      ? "bg-emerald-500/15 text-emerald-600"
      : status === "locked"
        ? "bg-amber-500/15 text-amber-700"
        : "bg-destructive/15 text-destructive";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${styles}`}>
      {status === "active" ? <CheckCircle2 className="size-3" /> : <LockKeyhole className="size-3" />}
      {label}
    </span>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={120}
        required={required}
      />
    </div>
  );
}
