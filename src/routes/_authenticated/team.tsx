import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Empty, PageHeader, Panel } from "@/components/GlassBits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { createTeamMember, resetMemberPassword } from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team & Logins — Ezmora Realty CRM" },
      {
        name: "description",
        content:
          "Owner controls for creating supervisor and sales logins, resetting passwords and reviewing the Ezmora Realty roster.",
      },
      { property: "og:title", content: "Team & Logins — Ezmora Realty CRM" },
      { property: "og:description", content: "Every login is created and owned by you." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const queryClient = useQueryClient();
  const addMember = useServerFn(createTeamMember);
  const resetPassword = useServerFn(resetMemberPassword);

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

  const { data: members } = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: true }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap = new Map((roles.data ?? []).map((row) => [row.user_id, row.role]));
      return (profiles.data ?? []).map((profile) => ({
        ...profile,
        role: roleMap.get(profile.id) ?? "employee",
      }));
    },
  });

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
      void queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reset = useMutation({
    mutationFn: async (args: { userId: string; password: string }) =>
      resetPassword({ data: args }),
    onSuccess: () => toast.success("Password updated"),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader
        title="Team &amp; Logins"
        subtitle="Create supervisor and sales logins, set designations and reset passwords."
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
              {(members ?? []).map((member) => (
                <li key={member.id} className="rounded-xl border border-border/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{member.full_name || "Unnamed"}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.email} · {member.designation ?? "—"} · {member.branch ?? "—"}
                      </p>
                    </div>
                    <span className="rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-medium text-gold capitalize">
                      {member.role}
                    </span>
                  </div>

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
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
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