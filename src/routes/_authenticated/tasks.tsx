import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Plus, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Empty, PageHeader, Panel } from "@/components/GlassBits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { TASK_TYPES } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Follow-ups & Notes — Ezmora Realty CRM" },
      {
        name: "description",
        content:
          "Schedule follow-ups, log notes, track paper work and record why an interaction was missed.",
      },
      { property: "og:title", content: "Follow-ups & Notes — Ezmora Realty CRM" },
      { property: "og:description", content: "Nothing slips through the sales floor." },
    ],
  }),
  component: TasksPage,
});

function TasksPage() {
  const { session, isManager } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState<string>("follow up");
  const [dueAt, setDueAt] = useState("");
  const [reason, setReason] = useState<Record<string, string>>({});

  const { data: tasks } = useQuery({
    queryKey: ["tasks", userId, isManager],
    enabled: Boolean(userId),
    queryFn: async () => {
      const query = supabase.from("tasks").select("*").order("due_at").limit(300);
      const { data, error } = isManager ? await query : await query.eq("assigned_to", userId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").insert({
        title: title.trim(),
        task_type: taskType,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        assigned_to: userId!,
        created_by: userId!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added to your follow-up log");
      setTitle("");
      setDueAt("");
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const close = useMutation({
    mutationFn: async (args: { id: string; status: string; missedReason?: string | null }) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          status: args.status,
          missed_reason: args.missedReason ?? null,
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const open = (tasks ?? []).filter((task) => task.status === "open");
  const closed = (tasks ?? []).filter((task) => task.status !== "open");
  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Follow-ups &amp; Notes"
        subtitle="Every scheduled action, note and paper-work item — with a reason logged when something is missed."
      />

      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <Panel title="Add an action">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                required
                placeholder="Call Mr. Shah about 2 BHK in Bandra"
              />
            </div>

            <div>
              <p className="mb-1.5 text-[11px] tracking-wide text-muted-foreground uppercase">
                Type
              </p>
              <div className="flex flex-wrap gap-2">
                {TASK_TYPES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTaskType(option)}
                    className={`press rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      taskType === option
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-due">Date &amp; time</Label>
              <Input
                id="task-due"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>

            <Button type="submit" className="press w-full" disabled={create.isPending}>
              <Plus className="size-4" /> Add action
            </Button>
          </form>
        </Panel>

        <div className="space-y-4">
          <Panel title={`Open — ${open.length}`}>
            {open.length === 0 ? (
              <Empty>Nothing pending. Well played.</Empty>
            ) : (
              <ul className="space-y-3">
                {open.map((task) => {
                  const overdue = task.due_at && new Date(task.due_at).getTime() < now;
                  return (
                    <li key={task.id} className="rounded-xl border border-border/70 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {task.task_type}
                            {task.due_at ? ` · ${new Date(task.due_at).toLocaleString()}` : ""}
                          </p>
                        </div>
                        {overdue && (
                          <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive">
                            <TriangleAlert className="size-3" /> missed
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          className="press"
                          onClick={() => close.mutate({ id: task.id, status: "done" })}
                        >
                          <CheckCircle2 className="size-4" /> Done
                        </Button>
                        <Input
                          value={reason[task.id] ?? ""}
                          onChange={(e) =>
                            setReason((prev) => ({ ...prev, [task.id]: e.target.value }))
                          }
                          maxLength={200}
                          placeholder="Reason if missed"
                          className="h-9 max-w-[220px]"
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          className="press"
                          onClick={() =>
                            close.mutate({
                              id: task.id,
                              status: "missed",
                              missedReason: reason[task.id]?.trim() || "No reason given",
                            })
                          }
                        >
                          Log as missed
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="History">
            {closed.length === 0 ? (
              <Empty>No closed actions yet.</Empty>
            ) : (
              <ul className="space-y-2">
                {closed.slice(0, 20).map((task) => (
                  <li
                    key={task.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{task.title}</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {task.status}
                      {task.missed_reason ? ` · ${task.missed_reason}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}