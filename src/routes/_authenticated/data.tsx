import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Database, FolderPlus, MapPin, Search, Share2, Trash2, Upload, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Empty, PageHeader, Panel, StatTile } from "@/components/GlassBits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DATA_TYPES, LOCALITIES, parseContactPaste } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/data")({
  head: () => ({
    meta: [
      { title: "Data Bank — Ezmora Realty CRM" },
      {
        name: "description",
        content:
          "Upload raw client data, distribute numbers to the sales floor and search the full Ezmora Realty data bank.",
      },
      { property: "og:title", content: "Data Bank — Ezmora Realty CRM" },
      { property: "og:description", content: "Raw data in, qualified calling queues out." },
    ],
  }),
  component: DataPage,
});

type DatasetRow = {
  id: string;
  title: string;
  location: string | null;
  data_type: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
};

function DataPage() {
  const { session, isManager } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();

  const [paste, setPaste] = useState("");
  const [source, setSource] = useState("Manual upload");
  const [search, setSearch] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [assignCount, setAssignCount] = useState("25");
  const [uploadDataset, setUploadDataset] = useState("");

  // Dataset form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dsTitle, setDsTitle] = useState("");
  const [dsLocation, setDsLocation] = useState("");
  const [dsType, setDsType] = useState<string>(DATA_TYPES[0]);
  const [dsDescription, setDsDescription] = useState("");

  // Dataset filters
  const [fTitle, setFTitle] = useState("");
  const [fLocation, setFLocation] = useState("");
  const [fType, setFType] = useState("");
  const [fOwner, setFOwner] = useState("");
  const [fAssignee, setFAssignee] = useState("");

  const { data } = useQuery({
    queryKey: ["contacts", userId, isManager],
    enabled: Boolean(userId),
    queryFn: async () => {
      // Row level security already limits employees to their own numbers and to
      // numbers inside data sets assigned to them.
      const [contacts, members] = await Promise.all([
        supabase
          .from("contacts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("profiles").select("id, full_name"),
      ]);
      return { contacts: contacts.data ?? [], members: members.data ?? [] };
    },
  });

  const datasetsQuery = useQuery({
    queryKey: ["datasets", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [sets, assignments] = await Promise.all([
        supabase.from("datasets").select("*").order("created_at", { ascending: false }),
        supabase.from("dataset_assignments").select("dataset_id, user_id"),
      ]);
      return {
        datasets: (sets.data ?? []) as DatasetRow[],
        assignments: assignments.data ?? [],
      };
    },
  });

  const datasets = datasetsQuery.data?.datasets ?? [];
  const assignments = datasetsQuery.data?.assignments ?? [];
  const members = data?.members ?? [];
  const memberName = (id: string | null) =>
    members.find((m) => m.id === id)?.full_name || "Unnamed";

  const contacts = data?.contacts ?? [];
  const parsed = parseContactPaste(paste);

  const datasetCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const contact of contacts) {
      const key = (contact as { dataset_id: string | null }).dataset_id;
      if (key) map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [contacts]);

  function resetDatasetForm() {
    setEditingId(null);
    setDsTitle("");
    setDsLocation("");
    setDsType(DATA_TYPES[0]);
    setDsDescription("");
  }

  const saveDataset = useMutation({
    mutationFn: async () => {
      if (!dsTitle.trim()) throw new Error("Give the data set a title.");
      if (!userId) throw new Error("Not signed in");
      const payload = {
        title: dsTitle.trim(),
        location: dsLocation.trim() || null,
        data_type: dsType,
        description: dsDescription.trim() || null,
      };
      if (editingId) {
        const { error } = await supabase.from("datasets").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("datasets")
          .insert({ ...payload, created_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Data set updated" : "Data set created");
      resetDatasetForm();
      void queryClient.invalidateQueries({ queryKey: ["datasets"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteDataset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("datasets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Data set deleted");
      void queryClient.invalidateQueries({ queryKey: ["datasets"] });
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleAssignment = useMutation({
    mutationFn: async (args: { datasetId: string; memberId: string; on: boolean }) => {
      if (args.on) {
        const { error } = await supabase.from("dataset_assignments").insert({
          dataset_id: args.datasetId,
          user_id: args.memberId,
          created_by: userId!,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("dataset_assignments")
          .delete()
          .eq("dataset_id", args.datasetId)
          .eq("user_id", args.memberId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["datasets"] });
      void queryClient.invalidateQueries({ queryKey: ["dial-queue"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!uploadDataset) throw new Error("Pick the data set this upload belongs to.");
      if (parsed.length === 0) throw new Error("No valid phone numbers found in that text.");
      const { error } = await supabase.from("contacts").insert(
        parsed.map((row) => ({
          name: row.name,
          phone: row.phone,
          source: source.trim() || "Manual upload",
          dataset_id: uploadDataset,
          created_by: userId!,
        })),
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${parsed.length} numbers added to the data bank`);
      setPaste("");
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const distribute = useMutation({
    mutationFn: async () => {
      if (!assignTo) throw new Error("Choose a team member first.");
      const limit = Math.max(1, Math.min(500, Number(assignCount) || 25));
      let pool = supabase
        .from("contacts")
        .select("id")
        .eq("status", "new")
        .is("assigned_to", null)
        .limit(limit);
      if (uploadDataset) pool = pool.eq("dataset_id", uploadDataset);
      const { data: rows, error: poolError } = await pool;
      if (poolError) throw poolError;
      if (!rows || rows.length === 0) throw new Error("No unassigned numbers left in the bank.");
      const { error } = await supabase
        .from("contacts")
        .update({
          assigned_to: assignTo,
          assigned_at: new Date().toISOString(),
          status: "assigned",
        })
        .in(
          "id",
          rows.map((row) => row.id),
        );
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} numbers assigned`);
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      void queryClient.invalidateQueries({ queryKey: ["dial-queue"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const term = search.trim().toLowerCase();
  const rows = contacts.filter(
    (contact) =>
      !term ||
      contact.phone.toLowerCase().includes(term) ||
      (contact.name ?? "").toLowerCase().includes(term),
  );

  const unassigned = contacts.filter((c) => !c.assigned_to).length;
  const leadsMade = contacts.filter((c) => c.status === "lead").length;

  const filteredDatasets = datasets.filter((set) => {
    if (fTitle && !set.title.toLowerCase().includes(fTitle.trim().toLowerCase())) return false;
    if (fLocation && (set.location ?? "") !== fLocation) return false;
    if (fType && set.data_type !== fType) return false;
    if (fOwner && set.created_by !== fOwner) return false;
    if (fAssignee && !assignments.some((a) => a.dataset_id === set.id && a.user_id === fAssignee))
      return false;
    return true;
  });

  const datasetTitle = (id: string | null) =>
    datasets.find((set) => set.id === id)?.title ?? "—";

  return (
    <>
      <PageHeader
        title="Data Bank"
        subtitle="Paste raw data, split it across the floor and search every number the firm owns."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total numbers" value={contacts.length} icon={Database} />
        <StatTile label="Unassigned" value={unassigned} icon={Share2} tone="warning" />
        <StatTile label="Converted to leads" value={leadsMade} icon={Upload} tone="success" />
        <StatTile label="Data sets" value={datasets.length} icon={FolderPlus} tone="gold" />
      </div>

      {isManager && (
        <div className="mt-4">
          <Panel title={editingId ? "Edit data set" : "Create a data set"}>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                saveDataset.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="ds-title">Data title</Label>
                <Input
                  id="ds-title"
                  value={dsTitle}
                  onChange={(e) => setDsTitle(e.target.value)}
                  maxLength={80}
                  placeholder="Andheri East Leads"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ds-location">Location</Label>
                <Input
                  id="ds-location"
                  value={dsLocation}
                  onChange={(e) => setDsLocation(e.target.value)}
                  maxLength={60}
                  list="ds-location-options"
                  placeholder="Andheri"
                />
                <datalist id="ds-location-options">
                  {LOCALITIES.map((loc) => (
                    <option key={loc} value={loc} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Data type</Label>
                <div className="flex flex-wrap gap-2">
                  {DATA_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDsType(type)}
                      className={`press rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        dsType === type
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ds-description">Description (optional)</Label>
                <Textarea
                  id="ds-description"
                  value={dsDescription}
                  onChange={(e) => setDsDescription(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Where this data came from, how fresh it is…"
                />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" className="press flex-1" disabled={saveDataset.isPending}>
                  <FolderPlus className="size-4" /> {editingId ? "Save changes" : "Create data set"}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="press"
                    onClick={resetDatasetForm}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Panel>
        </div>
      )}

      <div className="mt-4">
        <Panel title={isManager ? "Data sets" : "Your data sets"}>
          {isManager && (
            <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <Input
                value={fTitle}
                onChange={(e) => setFTitle(e.target.value)}
                maxLength={60}
                placeholder="Filter by title"
              />
              <select
                value={fLocation}
                onChange={(e) => setFLocation(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All locations</option>
                {Array.from(new Set(datasets.map((s) => s.location).filter(Boolean))).map((loc) => (
                  <option key={loc as string} value={loc as string}>
                    {loc}
                  </option>
                ))}
              </select>
              <select
                value={fType}
                onChange={(e) => setFType(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All types</option>
                {DATA_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <select
                value={fOwner}
                onChange={(e) => setFOwner(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Any owner</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name || "Unnamed"}
                  </option>
                ))}
              </select>
              <select
                value={fAssignee}
                onChange={(e) => setFAssignee(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Any assignee</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name || "Unnamed"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filteredDatasets.length === 0 ? (
            <Empty>
              {isManager
                ? "No data sets yet. Create one above, then upload numbers into it."
                : "No data sets assigned to you yet. The owner will share one with you."}
            </Empty>
          ) : (
            <ul className="space-y-3">
              {filteredDatasets.map((set) => {
                const assigned = assignments.filter((a) => a.dataset_id === set.id);
                return (
                  <li key={set.id} className="rounded-2xl border border-border/70 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold tracking-tight">{set.title}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="rounded-full border border-border px-2 py-0.5">
                            {set.data_type}
                          </span>
                          {set.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3" /> {set.location}
                            </span>
                          )}
                          <span>{datasetCounts.get(set.id) ?? 0} numbers</span>
                          <span>Owner: {memberName(set.created_by)}</span>
                        </p>
                        {set.description && (
                          <p className="mt-2 text-xs text-muted-foreground">{set.description}</p>
                        )}
                      </div>
                      {isManager && (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="press"
                            onClick={() => {
                              setEditingId(set.id);
                              setDsTitle(set.title);
                              setDsLocation(set.location ?? "");
                              setDsType(set.data_type);
                              setDsDescription(set.description ?? "");
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="press"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete "${set.title}"? Numbers stay in the bank but lose this label.`,
                                )
                              )
                                deleteDataset.mutate(set.id);
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {isManager ? (
                      <div className="mt-3 space-y-2">
                        <p className="flex items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          <Users className="size-3" /> Who can see this
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {members.map((member) => {
                            const on = assigned.some((a) => a.user_id === member.id);
                            return (
                              <button
                                key={member.id}
                                type="button"
                                onClick={() =>
                                  toggleAssignment.mutate({
                                    datasetId: set.id,
                                    memberId: member.id,
                                    on: !on,
                                  })
                                }
                                className={`press rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                  on
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border text-muted-foreground hover:bg-accent"
                                }`}
                              >
                                {member.full_name || "Unnamed"}
                              </button>
                            );
                          })}
                        </div>
                        {assigned.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            Private — only you can see this data set.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Call from this list in the Calling Engine.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {isManager && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="Upload data">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                upload.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="upload-dataset">Data set</Label>
                <select
                  id="upload-dataset"
                  value={uploadDataset}
                  onChange={(e) => setUploadDataset(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select a data set…</option>
                  {datasets.map((set) => (
                    <option key={set.id} value={set.id}>
                      {set.title}
                      {set.location ? ` · ${set.location}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paste">Paste numbers (one per line, name optional)</Label>
                <Textarea
                  id="paste"
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  rows={7}
                  maxLength={200000}
                  placeholder={"Rahul Mehta, 9820012345\n9930098765"}
                />
                <p className="text-xs text-muted-foreground">
                  {parsed.length} valid numbers detected
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Source label</Label>
                <Input
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  maxLength={60}
                />
              </div>
              <Button type="submit" className="press w-full" disabled={upload.isPending}>
                <Upload className="size-4" /> Add to data bank
              </Button>
            </form>
          </Panel>

          <Panel title="Distribute to the floor">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                distribute.mutate();
              }}
            >
              <div className="space-y-2">
                <Label>Team member</Label>
                <div className="flex flex-wrap gap-2">
                  {members.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setAssignTo(member.id)}
                      className={`press rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        assignTo === member.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {member.full_name || "Unnamed"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="count">How many numbers</Label>
                <Input
                  id="count"
                  type="number"
                  min={1}
                  max={500}
                  value={assignCount}
                  onChange={(e) => setAssignCount(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {uploadDataset
                  ? `Numbers are taken from "${datasetTitle(uploadDataset)}".`
                  : "Pick a data set above to pull numbers from that set only."}
              </p>
              <Button type="submit" className="press w-full" disabled={distribute.isPending}>
                <Share2 className="size-4" /> Assign numbers
              </Button>
            </form>
          </Panel>
        </div>
      )}

      <div className="mt-4">
        <Panel title="Search the bank">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={60}
              placeholder="Search by name or number"
              className="pl-9"
            />
          </div>

          {rows.length === 0 ? (
            <Empty>No numbers found.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Number</th>
                    <th className="pb-2">Data set</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((contact) => (
                    <tr key={contact.id} className="border-t border-border/60">
                      <td className="py-2 font-medium">{contact.name || "—"}</td>
                      <td className="py-2 font-mono text-xs">{contact.phone}</td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {datasetTitle((contact as { dataset_id: string | null }).dataset_id)}
                      </td>
                      <td className="py-2 capitalize">{contact.status}</td>
                      <td className="py-2 text-xs text-muted-foreground">{contact.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
