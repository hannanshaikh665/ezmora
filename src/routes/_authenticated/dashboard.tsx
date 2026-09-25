import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarClock,
  Flame,
  PhoneCall,
  PhoneOff,
  Target,
  Timer,
  TriangleAlert,
  Building2,
} from "lucide-react";

import { Empty, PageHeader, Panel, StatTile } from "@/components/GlassBits";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDuration } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Command Center — Ezmora Realty CRM" },
      {
        name: "description",
        content:
          "Today's calls, fresh leads, site visits and pipeline value across the Ezmora Realty sales floor.",
      },
      { property: "og:title", content: "Command Center — Ezmora Realty CRM" },
      { property: "og:description", content: "Live sales floor performance for Ezmora Realty." },
    ],
  }),
  component: Dashboard,
});

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function Dashboard() {
  const { profile, isManager, session } = useAuth();
  const userId = session?.user.id;

  const { data } = useQuery({
    queryKey: ["dashboard", userId, isManager],
    enabled: Boolean(userId),
    queryFn: async () => {
      const today = startOfToday();
      const [calls, leads, visits, tasks, queue, members] = await Promise.all([
        supabase.from("calls").select("*").gte("created_at", today),
        supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(400),
        supabase.from("site_visits").select("*").gte("visit_at", today),
        supabase.from("tasks").select("*").eq("status", "open").order("due_at"),
        supabase.from("contacts").select("id", { count: "exact", head: true }).in("status", ["new", "assigned"]),
        supabase.from("profiles").select("id, full_name, designation"),
      ]);
      return {
        calls: calls.data ?? [],
        leads: leads.data ?? [],
        visits: visits.data ?? [],
        tasks: tasks.data ?? [],
        queueCount: queue.count ?? 0,
        members: members.data ?? [],
      };
    },
  });

  const calls = data?.calls ?? [];
  const connected = calls.filter((c) => c.connected);
  const leads = data?.leads ?? [];
  const newLeadsToday = leads.filter((l) => l.created_at >= startOfToday());
  const now = Date.now();
  const missed = (data?.tasks ?? []).filter((t) => t.due_at && new Date(t.due_at).getTime() < now);
  const dueToday = (data?.tasks ?? []).filter(
    (t) => t.due_at && new Date(t.due_at).getTime() >= now,
  );
  const hotLeads = leads.filter((l) => l.temperature === "hot");

  const perEmployee = (data?.members ?? []).map((member) => {
    const own = calls.filter((c) => c.employee_id === member.id);
    const ownConnected = own.filter((c) => c.connected);
    return {
      id: member.id,
      name: member.full_name || "Unnamed",
      designation: member.designation ?? "",
      total: own.length,
      connected: ownConnected.length,
      notConnected: own.length - ownConnected.length,
      talkTime: ownConnected.reduce((sum, c) => sum + c.duration_seconds, 0),
      leads: leads.filter((l) => l.assigned_to === member.id).length,
    };
  });

  return (
    <>
      <PageHeader
        title={isManager ? "Command Center" : `Good to see you, ${profile?.full_name ?? "team"}`}
        subtitle={
          isManager
            ? "Live view of today's calls, fresh leads, visits and pipeline."
            : "Your workspace for today — dial, log and follow up."
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Calls today" value={calls.length} icon={PhoneCall} />
        <StatTile
          label="Connected"
          value={connected.length}
          hint={`${calls.length - connected.length} not connected`}
          icon={Timer}
          tone="success"
        />
        <StatTile
          label="Talk time"
          value={formatDuration(connected.reduce((s, c) => s + c.duration_seconds, 0))}
          icon={PhoneOff}
          tone="gold"
        />
        <StatTile label="New leads" value={newLeadsToday.length} icon={Target} tone="primary" />
        <StatTile
          label="Site visits"
          value={data?.visits.length ?? 0}
          hint="scheduled today"
          icon={Building2}
          tone="warning"
        />
        <StatTile label="Hot leads" value={hotLeads.length} icon={Flame} tone="destructive" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Missed interactions"
          action={
            <Link to="/tasks" className="press text-xs font-medium text-primary">
              Open log
            </Link>
          }
        >
          {missed.length === 0 ? (
            <Empty>Nothing overdue. The floor is clean.</Empty>
          ) : (
            <ul className="space-y-2">
              {missed.slice(0, 6).map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <TriangleAlert className="size-4 text-destructive" />
                    <span className="font-medium">{task.title}</span>
                    <span className="text-xs text-muted-foreground">{task.task_type}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {task.due_at ? new Date(task.due_at).toLocaleString() : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Coming up"
          action={
            <span className="text-xs text-muted-foreground">{data?.queueCount ?? 0} in dialer</span>
          }
        >
          {dueToday.length === 0 ? (
            <Empty>No scheduled follow-ups ahead.</Empty>
          ) : (
            <ul className="space-y-2">
              {dueToday.slice(0, 6).map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <CalendarClock className="size-4 text-primary" />
                    <span className="font-medium">{task.title}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {task.due_at ? new Date(task.due_at).toLocaleString() : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {isManager && (
        <div className="mt-4">
          <Panel title="Supervisor view — calls by employee">
            {perEmployee.length === 0 ? (
              <Empty>No team members yet.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                      <th className="pb-2">Employee</th>
                      <th className="pb-2">Total calls</th>
                      <th className="pb-2">Connected</th>
                      <th className="pb-2">Not connected</th>
                      <th className="pb-2">Talk time</th>
                      <th className="pb-2">Leads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perEmployee.map((row) => (
                      <tr key={row.id} className="border-t border-border/60">
                        <td className="py-2 font-medium">
                          {row.name}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {row.designation}
                          </span>
                        </td>
                        <td className="py-2">{row.total}</td>
                        <td className="py-2 text-success">{row.connected}</td>
                        <td className="py-2 text-muted-foreground">{row.notConnected}</td>
                        <td className="py-2">{formatDuration(row.talkTime)}</td>
                        <td className="py-2">{row.leads}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}