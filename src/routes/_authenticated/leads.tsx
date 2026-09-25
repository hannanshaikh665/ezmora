import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Flame, Search, Snowflake, Sun } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Empty, PageHeader, Panel } from "@/components/GlassBits";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { LEAD_STAGES, TEMPERATURES } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({
    meta: [
      { title: "Lead Pipeline — Ezmora Realty CRM" },
      {
        name: "description",
        content:
          "Every qualified Ezmora Realty lead with budget, configuration, locality, temperature and stage in one pipeline.",
      },
      { property: "og:title", content: "Lead Pipeline — Ezmora Realty CRM" },
      { property: "og:description", content: "Qualified buyers, sorted by heat and stage." },
    ],
  }),
  component: LeadsPage,
});

const TEMP_ICON = { cold: Snowflake, warm: Sun, hot: Flame } as const;

function LeadsPage() {
  const { session, isManager } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [temp, setTemp] = useState<string>("all");
  const [stage, setStage] = useState<string>("all");

  const { data: leads } = useQuery({
    queryKey: ["leads", userId, isManager],
    enabled: Boolean(userId),
    queryFn: async () => {
      const query = supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      const { data, error } = isManager ? await query : await query.eq("assigned_to", userId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const update = useMutation({
    mutationFn: async (args: { id: string; patch: { stage?: string; temperature?: string } }) => {
      const { error } = await supabase.from("leads").update(args.patch).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead updated");
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const term = search.trim().toLowerCase();
  const rows = (leads ?? []).filter((lead) => {
    if (temp !== "all" && lead.temperature !== temp) return false;
    if (stage !== "all" && lead.stage !== stage) return false;
    if (!term) return true;
    return [lead.name, lead.phone, lead.locality, lead.budget, lead.configuration]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  return (
    <>
      <PageHeader
        title="Lead Pipeline"
        subtitle="Qualified buyers captured from calls, filtered by heat, stage and requirement."
        action={
          <span className="glass rounded-full px-4 py-2 text-xs font-medium tracking-wide uppercase">
            {rows.length} leads
          </span>
        }
      />

      <Panel title="Filters">
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={60}
              placeholder="Search name, number, locality or budget"
              className="pl-9"
            />
          </div>
          <FilterRow
            label="Temperature"
            options={["all", ...TEMPERATURES]}
            value={temp}
            onChange={setTemp}
          />
          <FilterRow
            label="Stage"
            options={["all", ...LEAD_STAGES]}
            value={stage}
            onChange={setStage}
          />
        </div>
      </Panel>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.length === 0 ? (
          <div className="md:col-span-2 xl:col-span-3">
            <Empty>No leads match these filters yet.</Empty>
          </div>
        ) : (
          rows.map((lead) => {
            const Icon = TEMP_ICON[(lead.temperature ?? "warm") as keyof typeof TEMP_ICON] ?? Sun;
            return (
              <article key={lead.id} className="glass-panel glass-hover rise p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">{lead.name}</h3>
                    <a
                      href={`tel:${lead.phone}`}
                      className="font-mono text-sm text-primary hover:underline"
                    >
                      {lead.phone}
                    </a>
                  </div>
                  <Icon className="size-4 text-gold" />
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <Field label="Looking for" value={lead.looking_for} />
                  <Field label="Configuration" value={lead.configuration} />
                  <Field label="Budget" value={lead.budget} />
                  <Field label="Locality" value={lead.locality} />
                </dl>

                {lead.notes && (
                  <p className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                    {lead.notes}
                  </p>
                )}

                <p className="mt-3 text-xs text-muted-foreground">
                  {lead.follow_up_at
                    ? `Follow-up ${new Date(lead.follow_up_at).toLocaleString()}`
                    : "No follow-up scheduled"}
                </p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {LEAD_STAGES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => update.mutate({ id: lead.id, patch: { stage: option } })}
                      className={`press rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                        lead.stage === option
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {TEMPERATURES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => update.mutate({ id: lead.id, patch: { temperature: option } })}
                      className={`press rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                        lead.temperature === option
                          ? "border-gold bg-gold text-gold-foreground"
                          : "border-border text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </article>
            );
          })
        )}
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`press rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              value === option
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}