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
import { useMemo, useState } from "react";

import { Empty, PageHeader, Panel, StatTile } from "@/components/GlassBits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type FilterMode = "today" | "yesterday" | "date" | "range";

type Period = {
  start: string;
  end: string;
  label: string;
};

function localDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDayBounds(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function currentPeriod(mode: FilterMode, dateValue: string, rangeStart: string, rangeEnd: string): Period {
  const today = new Date();
  const todayValue = localDateValue(today);
  if (mode === "today") {
    const bounds = localDayBounds(todayValue);
    return { ...bounds, label: "Today" };
  }
  if (mode === "yesterday") {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const bounds = localDayBounds(localDateValue(yesterday));
    return { ...bounds, label: "Yesterday" };
  }
  if (mode === "date") {
    const value = dateValue || todayValue;
    const bounds = localDayBounds(value);
    return { ...bounds, label: new Date(`${value}T00:00:00`).toLocaleDateString() };
  }
  const startValue = rangeStart || todayValue;
  const endValue = rangeEnd || startValue;
  const start = localDayBounds(startValue).start;
  const end = localDayBounds(endValue).end;
  return {
    start: start <= end ? start : localDayBounds(endValue).start,
    end: start <= end ? end : localDayBounds(startValue).end,
    label: `${new Date(`${startValue}T00:00:00`).toLocaleDateString()} – ${new Date(`${endValue}T00:00:00`).toLocaleDateString()}`,
  };
}

function Dashboard() {
  const { profile, isManager, session } = useAuth();
  const userId = session?.user.id;
  const todayValue = localDateValue(new Date());
  const yesterdayValue = localDateValue(new Date(Date.now() - 86400000));
  const [filterMode, setFilterMode] = useState<FilterMode>("today");
  const [dateValue, setDateValue] = useState(todayValue);
  const [rangeStart, setRangeStart] = useState(yesterdayValue);
  const [rangeEnd, setRangeEnd] = useState(todayValue);

  const period = useMemo(
    () => currentPeriod(filterMode, dateValue, rangeStart, rangeEnd),
    [filterMode, dateValue, rangeStart, rangeEnd],
  );

  const { data } = useQuery({
    queryKey: ["dashboard", userId, isManager, period.start, period.end],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [calls, leads, visits, tasks, queue, members] = await Promise.all([
        supabase
          .from("calls")
          .select("id, employee_id, connected, duration_seconds, created_at")
          .gte("created_at", period.start)
          .lt("created_at", period.end),
        supabase
          .from("leads")
          .select("id, assigned_to, created_by, created_at")
          .gte("created_at", period.start)
          .lt("created_at", period.end)
          .order("created_at", { ascending: false }),
        supabase
          .from("site_visits")
          .select("*")
          .gte("visit_at", period.start)
          .lt("visit_at", period.end),
        supabase
          .from("tasks")
          .select("id, assigned_to, created_by, task_type, created_at, due_at, status, title")
          .gte("created_at", period.start)
          .lt("created_at", period.end)
          .order("due_at"),
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
  const followUps = (data?.tasks ?? []).filter((task) => task.task_type.toLowerCase().includes("follow"));
  const now = Date.now();
  const missed = (data?.tasks ?? []).filter((t) => t.due_at && new Date(t.due_at).getTime() < now);
  const dueToday = (data?.tasks ?? []).filter(
    (t) => t.due_at && new Date(t.due_at).getTime() >= now,
  );
  const hotLeads = leads.filter((l) => l.created_at >= period.start && l.created_at < period.end);

  const perEmployee = (data?.members ?? []).map((member) => {
    const own = calls.filter((c) => c.employee_id === member.id);
    const ownConnected = own.filter((c) => c.connected);
    const ownTalkTime = ownConnected.reduce((sum, c) => sum + c.duration_seconds, 0);
    const ownFollowUps = followUps.filter(
      (task) => task.assigned_to === member.id || task.created_by === member.id,
    );
    return {
      id: member.id,
      name: member.full_name || "Unnamed",
      designation: member.designation ?? "",
      total: own.length,
      connected: ownConnected.length,
      notConnected: own.length - ownConnected.length,
      talkTime: ownTalkTime,
      averageTalkTime: ownConnected.length ? Math.round(ownTalkTime / ownConnected.length) : 0,
      leads: leads.filter((l) => l.assigned_to === member.id || l.created_by === member.id).length,
      followUps: ownFollowUps.length,
    };
  });

  const filterButton = (mode: FilterMode, label: string) => (
    <button
      type="button"
      onClick={() => setFilterMode(mode)}
      className={`press rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        filterMode === mode
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-accent"
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      <PageHeader
        title={isManager ? "Command Center" : `Good to see you, ${profile?.full_name ?? "team"}`}
        subtitle={
          isManager
            ? `Calls, leads and follow-ups for ${period.label.toLowerCase()}.`
            : "Your workspace for today — dial, log and follow up."
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label={`Calls — ${period.label}`} value={calls.length} icon={PhoneCall} />
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
        <StatTile label="Leads created" value={leads.length} icon={Target} tone="primary" />
        <StatTile label="Follow-ups created" value={followUps.length} icon={CalendarClock} tone="warning" />
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
          action={<span className="text-xs text-muted-foreground">{data?.queueCount ?? 0} in dialer</span>}
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
          <Panel
            title="Supervisor view — calls by employee"
            action={<span className="text-xs text-muted-foreground">{period.label}</span>}
          >
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Period</span>
              {filterButton("today", "Today")}
              {filterButton("yesterday", "Yesterday")}
              {filterButton("date", "Custom date")}
              {filterButton("range", "Date range")}
              {filterMode === "date" && (
                <Input
                  type="date"
                  value={dateValue}
                  onChange={(event) => setDateValue(event.target.value)}
                  className="h-8 w-auto"
                  aria-label="Custom date"
                />
              )}
              {filterMode === "range" && (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="date"
                    value={rangeStart}
                    onChange={(event) => setRangeStart(event.target.value)}
                    className="h-8 w-auto"
                    aria-label="Range start"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={rangeEnd}
                    onChange={(event) => setRangeEnd(event.target.value)}
                    className="h-8 w-auto"
                    aria-label="Range end"
                  />
                </div>
              )}
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-7">
              <MiniMetric label="Total calls" value={calls.length} />
              <MiniMetric label="Connected" value={connected.length} />
              <MiniMetric label="Not connected" value={calls.length - connected.length} />
              <MiniMetric label="Talk time" value={formatDuration(connected.reduce((s, c) => s + c.duration_seconds, 0))} />
              <MiniMetric label="Avg talk" value={formatDuration(connected.length ? Math.round(connected.reduce((s, c) => s + c.duration_seconds, 0) / connected.length) : 0)} />
              <MiniMetric label="Leads" value={leads.length} />
              <MiniMetric label="Follow-ups" value={followUps.length} />
            </div>

            {perEmployee.length === 0 ? (
              <Empty>No team members yet.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead>
                    <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                      <th className="pb-2">Employee</th>
                      <th className="pb-2">Total calls</th>
                      <th className="pb-2">Connected</th>
                      <th className="pb-2">Not connected</th>
                      <th className="pb-2">Talk time</th>
                      <th className="pb-2">Avg talk</th>
                      <th className="pb-2">Leads</th>
                      <th className="pb-2">Follow-ups</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perEmployee.map((row) => (
                      <tr key={row.id} className="border-t border-border/60">
                        <td className="py-2 font-medium">
                          {row.name}
                          <span className="ml-2 text-xs text-muted-foreground">{row.designation}</span>
                        </td>
                        <td className="py-2">{row.total}</td>
                        <td className="py-2 text-success">{row.connected}</td>
                        <td className="py-2 text-muted-foreground">{row.notConnected}</td>
                        <td className="py-2">{formatDuration(row.talkTime)}</td>
                        <td className="py-2">{formatDuration(row.averageTalkTime)}</td>
                        <td className="py-2">{row.leads}</td>
                        <td className="py-2">{row.followUps}</td>
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

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
