import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Phone, PhoneOff, PhoneOutgoing, SkipForward, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Empty, PageHeader, Panel } from "@/components/GlassBits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  BUDGETS,
  CONFIGURATIONS,
  LOCALITIES,
  LOOKING_FOR,
  formatDuration,
  normalizePhone,
} from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/calling")({
  head: () => ({
    meta: [
      { title: "Calling Engine — Ezmora Realty CRM" },
      {
        name: "description",
        content:
          "One-tap dialing through your assigned Ezmora Realty data set with automatic call logging and lead capture.",
      },
      { property: "og:title", content: "Calling Engine — Ezmora Realty CRM" },
      { property: "og:description", content: "Dial, log and qualify without leaving the screen." },
    ],
  }),
  component: CallingPage,
});

type Phase = "idle" | "dialing" | "outcome" | "capture";

type ManualContact = {
  id: string;
  name: string | null;
  phone: string;
  source: string | null;
  created_at: string;
};

const CALL_RETURN_KEY = "ezmora-call-return";

/**
 * Opens the native dialer without navigating the CRM page away, so the app is
 * still loaded (and refocused) the moment the call ends.
 * We also set a sessionStorage marker so that if the automatic redirect fails
 * and the user lands back on a different CRM route, the app can return them to
 * the calling page.
 */
function launchDialer(phone: string) {
  const href = `tel:${phone}`;
  try {
    sessionStorage.setItem(CALL_RETURN_KEY, window.location.href);
  } catch {
    // ignore storage errors
  }
  const link = document.createElement("a");
  link.href = href;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => link.remove(), 0);
}

function CallingPage() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [connected, setConnected] = useState(false);
  const phaseRef = useRef<Phase>("idle");
  const finishRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const [manual, setManual] = useState<ManualContact | null>(null);
  const [manualPhone, setManualPhone] = useState("");
  const [manualName, setManualName] = useState("");

  const [name, setName] = useState("");
  const [lookingFor, setLookingFor] = useState<string>("");
  const [configuration, setConfiguration] = useState<string>("");
  const [budget, setBudget] = useState<string>("");
  const [locality, setLocality] = useState<string>("");
  const [customLocality, setCustomLocality] = useState("");
  const [temperature, setTemperature] = useState("warm");
  const [followUp, setFollowUp] = useState("");
  const [notes, setNotes] = useState("");

  const [datasetId, setDatasetId] = useState("");

  const datasetsQuery = useQuery({
    queryKey: ["calling-datasets", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("datasets")
        .select("id, title, location, data_type")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const datasets = datasetsQuery.data ?? [];

  const queueQuery = useQuery({
    queryKey: ["dial-queue", userId, datasetId],
    enabled: Boolean(userId),
    queryFn: async () => {
      // Row level security keeps employees to their own numbers and to numbers
      // inside data sets that were assigned to them.
      let query = supabase
        .from("contacts")
        .select("*")
        .in("status", ["new", "assigned"])
        .order("created_at", { ascending: true })
        .limit(200);
      if (datasetId) query = query.eq("dataset_id", datasetId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const queue = queueQuery.data ?? [];
  const current = manual ?? queue[0];


  const startManualCall = useMutation({
    mutationFn: async () => {
      const phone = normalizePhone(manualPhone);
      if (phone.replace(/\D/g, "").length < 8) throw new Error("Enter a valid phone number");
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("contacts")
        .insert({
          name: manualName.trim() || null,
          phone,
          source: "Incoming / manual",
          status: "assigned",
          assigned_to: userId,
          assigned_at: new Date().toISOString(),
          created_by: userId,
          dataset_id: datasetId || null,
        })
        .select("id, name, phone, source, created_at")

        .single();
      if (error) throw error;
      return data as ManualContact;
    },
    onSuccess: (contact) => {
      setManual(contact);
      setName(contact.name ?? "");
      setManualPhone("");
      setManualName("");
      beginCall(contact.phone);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function resetForm() {
    setName("");
    setLookingFor("");
    setConfiguration("");
    setBudget("");
    setLocality("");
    setCustomLocality("");
    setTemperature("warm");
    setFollowUp("");
    setNotes("");
  }

  function startCall() {
    if (!current) return;
    beginCall(current.phone);
  }

  function beginCall(phone: string) {
    setSeconds(0);
    setConnected(false);
    setPhase("dialing");
    launchDialer(phone);
  }

  /**
   * The browser `tel:` flow exposes no reliable answered/connected signal.
   * Returning from the native dialer therefore only ends the local ringing
   * state; it must never be interpreted as proof that the call was answered.
   * This safely records an unknown/not-connected call with zero talk time,
   * including carrier/network announcements.
   */
  function finishCall() {
    if (phaseRef.current !== "dialing") return;
    setSeconds(0);
    setConnected(false);
    setPhase("idle");
    toast.info("Call state unavailable — recorded as not connected with 0 talk time");
    logCall.mutate({
      connected: false,
      outcome: "unknown — native dialer state unavailable",
      status: "not connected",
      duration: 0,
    });
  }

  finishRef.current = finishCall;

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") finishRef.current?.();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  const logCall = useMutation({
    mutationFn: async (args: {
      connected: boolean;
      outcome: string;
      status: string;
      duration: number;
    }) => {
      if (!current || !userId) return;
      await supabase.from("calls").insert({
        contact_id: current.id,
        employee_id: userId,
        phone: current.phone,
        connected: args.connected,
        duration_seconds: args.duration,
        outcome: args.outcome,
      });
      await supabase.from("contacts").update({ status: args.status }).eq("id", current.id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dial-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setManual(null);
    },
  });

  const saveLead = useMutation({
    mutationFn: async () => {
      if (!current || !userId) return;
      const finalLocality = customLocality.trim() || locality || null;
      const currentDataset =
        (current as { dataset_id?: string | null }).dataset_id ?? (datasetId || null);
      await supabase.from("calls").insert({
        contact_id: current.id,
        employee_id: userId,
        phone: current.phone,
        connected: true,
        duration_seconds: seconds,
        outcome: "lead captured",
      });
      const { error } = await supabase.from("leads").insert({
        contact_id: current.id,
        name: name.trim() || current.name,
        phone: current.phone,
        looking_for: lookingFor || null,
        configuration: configuration || null,
        budget: budget || null,
        locality: finalLocality,
        temperature,
        follow_up_at: followUp ? new Date(followUp).toISOString() : null,
        notes: notes.trim() || null,
        assigned_to: userId,
        created_by: userId,
        dataset_id: currentDataset,
      });
      if (error) throw error;
      if (followUp) {
        await supabase.from("tasks").insert({
          title: `Follow up — ${name.trim() || current.phone}`,
          task_type: "follow up",
          due_at: new Date(followUp).toISOString(),
          contact_id: current.id,
          assigned_to: userId,
          created_by: userId,
          dataset_id: currentDataset,
        });
      }
      await supabase.from("contacts").update({ status: "lead", name: name.trim() || current.name }).eq("id", current.id);

    },
    onSuccess: () => {
      toast.success("Lead saved and moved to the lead section");
      resetForm();
      setPhase("idle");
      setSeconds(0);
      setManual(null);
      void queryClient.invalidateQueries({ queryKey: ["dial-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader
        title="Calling Engine"
        subtitle="Tap to dial the next number. Not connected moves on silently — connected opens the capture flow."
        action={
          <span className="glass rounded-full px-4 py-2 text-xs font-medium tracking-wide uppercase">
            {queue.length} numbers in queue
          </span>
        }
      />

      {datasets.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Data set
          </span>
          <button
            type="button"
            onClick={() => setDatasetId("")}
            className={`press rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              datasetId === ""
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            All my lists
          </button>
          {datasets.map((set) => (
            <button
              key={set.id}
              type="button"
              onClick={() => setDatasetId(set.id)}
              className={`press rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                datasetId === set.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {set.title}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Now calling">
          {manual && (
            <p className="mb-3 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-medium">
              External call added manually — log the outcome to return to your queue.
            </p>
          )}
          {!current ? (
            <Empty>
              No numbers in your queue. Ask the owner to assign a fresh set from the Data screen.
            </Empty>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/70 p-4">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">Client</p>
                <p className="text-2xl font-semibold tracking-tight">
                  {current.name || "Name not provided"}
                </p>
                <p className="mt-1 font-mono text-lg text-primary">{current.phone}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Added {new Date(current.created_at).toLocaleDateString()} · {current.source}
                </p>
              </div>

              {phase === "idle" && (
                <div className="flex flex-wrap gap-2">
                  <Button size="lg" className="press flex-1" onClick={startCall}>
                    <Phone className="size-4" /> Call now
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="press"
                    onClick={() =>
                      logCall.mutate({
                        connected: false,
                        outcome: "skipped",
                        status: "skipped",
                        duration: 0,
                      })
                    }
                  >
                    <SkipForward className="size-4" /> Skip
                  </Button>
                </div>
              )}

              {phase === "dialing" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-2xl border border-primary/40 bg-primary/5 px-4 py-3">
                    <Timer className="size-4 text-primary" />
                    <span className="font-mono text-lg">
                      {connected ? formatDuration(seconds) : "--:--"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {connected ? "connected — timer running" : "ringing… connection state unavailable"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button className="press flex-1" onClick={finishCall}>
                      <PhoneOff className="size-4" /> Call ended
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The browser cannot read native answered/connected state, so this call is never
                    marked connected automatically.
                  </p>
                </div>
              )}

              {phase === "outcome" && (
                <div className="space-y-3 rounded-2xl border border-border/70 p-4">
                  <p className="text-sm font-medium">
                    Call lasted {formatDuration(seconds)}. Is it a lead?
                  </p>
                  <div className="flex gap-2">
                    <Button className="press flex-1" onClick={() => setPhase("capture")}>
                      Yes, it's a lead
                    </Button>
                    <Button
                      variant="secondary"
                      className="press flex-1"
                      onClick={() => {
                        setPhase("idle");
                        const duration = seconds;
                        setSeconds(0);
                        logCall.mutate({
                          connected: true,
                          outcome: "not interested",
                          status: "not interested",
                          duration,
                        });
                      }}
                    >
                      No — next number
                    </Button>
                  </div>
                </div>
              )}

              {phase === "capture" && (
                <form
                  className="space-y-4 rounded-2xl border border-border/70 p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveLead.mutate();
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="client-name">Client name</Label>
                    <Input
                      id="client-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={80}
                      placeholder="Client name"
                      required
                    />
                  </div>

                  <ChipGroup
                    label="What is the client looking for?"
                    options={[...LOOKING_FOR]}
                    value={lookingFor}
                    onChange={setLookingFor}
                  />
                  <ChipGroup
                    label="Configuration"
                    options={[...CONFIGURATIONS]}
                    value={configuration}
                    onChange={setConfiguration}
                  />
                  <ChipGroup
                    label="Budget"
                    options={[...BUDGETS]}
                    value={budget}
                    onChange={setBudget}
                  />
                  <ChipGroup
                    label="Locality"
                    options={[...LOCALITIES]}
                    value={locality}
                    onChange={setLocality}
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="custom-locality">Add locality manually</Label>
                      <Input
                        id="custom-locality"
                        value={customLocality}
                        onChange={(e) => setCustomLocality(e.target.value)}
                        maxLength={60}
                        placeholder="Other locality"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="follow-up">Follow-up date &amp; time</Label>
                      <Input
                        id="follow-up"
                        type="datetime-local"
                        value={followUp}
                        onChange={(e) => setFollowUp(e.target.value)}
                      />
                    </div>
                  </div>

                  <ChipGroup
                    label="Lead temperature"
                    options={["cold", "warm", "hot"]}
                    value={temperature}
                    onChange={setTemperature}
                  />

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={1000}
                      placeholder="What did the client say?"
                    />
                  </div>

                  <Button type="submit" size="lg" className="press w-full" disabled={saveLead.isPending}>
                    Done — save lead
                  </Button>
                </form>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Up next">
          <form
            className="mb-4 space-y-3 rounded-2xl border border-border/70 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              startManualCall.mutate();
            }}
          >
            <p className="text-sm font-medium">Add call</p>
            <p className="text-xs text-muted-foreground">
              Got a number from outside the queue? Add it, dial it, then mark the lead type.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="manual-phone">Phone number</Label>
                <Input
                  id="manual-phone"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  inputMode="tel"
                  maxLength={20}
                  placeholder="+91 98XXXXXXXX"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manual-name">Name (optional)</Label>
                <Input
                  id="manual-name"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  maxLength={80}
                  placeholder="Client name"
                />
              </div>
            </div>
            <Button
              type="submit"
              className="press w-full"
              disabled={startManualCall.isPending || phase !== "idle"}
            >
              <PhoneOutgoing className="size-4" /> Add call &amp; dial
            </Button>
            {phase !== "idle" && (
              <p className="text-xs text-muted-foreground">
                Finish logging the current call first.
              </p>
            )}
          </form>

          {(manual ? queue : queue.slice(1)).length === 0 ? (
            <Empty>Nothing queued behind this number.</Empty>
          ) : (
            <ul className="space-y-2">
              {(manual ? queue : queue.slice(1)).slice(0, 12).map((contact) => (
                <li
                  key={contact.id}
                  className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{contact.name || "Unnamed"}</span>
                  <span className="font-mono text-xs text-muted-foreground">{contact.phone}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`press rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              value === option
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
