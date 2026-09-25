import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  FileUp,
  Mail,
  MessageCircle,
  MessageSquare,
  Paperclip,
  Send,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Empty, PageHeader, Panel } from "@/components/GlassBits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { sendBlast } from "@/lib/blast.functions";
import { LOCALITIES, parseContactPaste } from "@/lib/crm";
import { cleanRecipients, mediaKind } from "@/lib/phone";
import { extractRecipients, type Recipient } from "@/lib/recipient-import";
import {
  getWhatsappStatus,
  saveWhatsappSettings,
  sendTestMessage,
  testWhatsappConnection,
} from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/blast")({
  head: () => ({
    meta: [
      { title: "Blast Studio — Ezmora Realty CRM" },
      {
        name: "description",
        content:
          "Build WhatsApp, SMS and email blasts for filtered Ezmora Realty audiences and keep a record of every campaign.",
      },
      { property: "og:title", content: "Blast Studio — Ezmora Realty CRM" },
      { property: "og:description", content: "One message, the right audience, every channel." },
    ],
  }),
  component: BlastPage,
});

const CHANNELS = [
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "sms", label: "SMS", icon: MessageSquare },
  { id: "email", label: "Email", icon: Mail },
] as const;

type BlastRow = {
  id: string;
  channel: string;
  message: string;
  status: string;
  recipient_count: number;
  recipients: unknown;
  attachments: unknown;
  created_at: string;
  sent_count?: number;
  failed_count?: number;
  invalid_count?: number;
  duplicate_count?: number;
  send_error?: string | null;
};

function BlastPage() {
  const { session, isOwner } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const runSendBlast = useServerFn(sendBlast);
  const runWhatsappStatus = useServerFn(getWhatsappStatus);
  const runSaveSettings = useServerFn(saveWhatsappSettings);
  const runTestConnection = useServerFn(testWhatsappConnection);
  const runTestMessage = useServerFn(sendTestMessage);

  const [channel, setChannel] = useState<string>("whatsapp");
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState("");
  const [uploads, setUploads] = useState<{ name: string; url: string }[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [locality, setLocality] = useState<string>("all");
  const [temperature, setTemperature] = useState<string>("all");
  const [manualNumbers, setManualNumbers] = useState("");
  const [imported, setImported] = useState<Recipient[]>([]);
  const [importing, setImporting] = useState(false);
  const [testNumber, setTestNumber] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const mediaInput = useRef<HTMLInputElement>(null);

  const { data } = useQuery({
    queryKey: ["blast-data", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [leads, blasts] = await Promise.all([
        supabase.from("leads").select("id, name, phone, locality, temperature").limit(1000),
        supabase.from("blasts").select("*").order("created_at", { ascending: false }).limit(20),
      ]);
      return { leads: leads.data ?? [], blasts: blasts.data ?? [] };
    },
  });

  const leadAudience = (data?.leads ?? []).filter((lead) => {
    if (locality !== "all" && lead.locality !== locality) return false;
    if (temperature !== "all" && lead.temperature !== temperature) return false;
    return true;
  });

  const customRecipients: Recipient[] = (() => {
    const rows = [...parseContactPaste(manualNumbers), ...imported];
    const seen = new Set<string>();
    return rows.filter((row) => {
      if (seen.has(row.phone)) return false;
      seen.add(row.phone);
      return true;
    });
  })();

  const audience: { name: string | null; phone: string }[] =
    customRecipients.length > 0 ? customRecipients : leadAudience;

  const attachmentList = [attachment.trim(), ...uploads.map((file) => file.url)].filter(Boolean);
  const audienceCheck = cleanRecipients(audience);
  const unsupportedMedia = attachmentList.filter((url) => !mediaKind(url));

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setImporting(true);
    try {
      const results = await Promise.all(Array.from(files).map((file) => extractRecipients(file)));
      const rows = results.flat();
      if (rows.length === 0) {
        toast.error("No phone numbers found in that file.");
      } else {
        setImported((prev) => {
          const seen = new Set(prev.map((row) => row.phone));
          return [...prev, ...rows.filter((row) => !seen.has(row.phone))];
        });
        toast.success(`${rows.length} numbers imported`);
      }
    } catch {
      toast.error("Could not read that file. Try Excel, CSV, PDF or a text file.");
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function handleMedia(files: FileList | null) {
    if (!files || files.length === 0 || !userId) return;
    setUploadingMedia(true);
    try {
      for (const file of Array.from(files)) {
        const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error } = await supabase.storage.from("blast-media").upload(path, file);
        if (error) throw error;
        const { data: signed } = await supabase.storage
          .from("blast-media")
          .createSignedUrl(path, 60 * 60 * 24 * 30);
        if (signed?.signedUrl) {
          setUploads((prev) => [...prev, { name: file.name, url: signed.signedUrl }]);
        }
      }
      toast.success("Attachment uploaded");
    } catch {
      toast.error("Could not upload that file.");
    } finally {
      setUploadingMedia(false);
      if (mediaInput.current) mediaInput.current.value = "";
    }
  }

  async function saveBlast(status: "draft" | "sending") {
    if (!message.trim() && attachmentList.length === 0) {
      throw new Error("Write a message or add an attachment first.");
    }
    if (audienceCheck.valid.length === 0) {
      throw new Error("No valid phone numbers in this recipient list.");
    }
    if (channel === "whatsapp" && unsupportedMedia.length > 0) {
      throw new Error(`WhatsApp cannot send this attachment: ${unsupportedMedia[0]}`);
    }
    const { data: inserted, error } = await supabase
      .from("blasts")
      .insert({
        channel,
        message: message.trim(),
        recipient_count: audience.length,
        recipients: audience.map((lead) => ({ name: lead.name, phone: lead.phone })),
        attachments: attachmentList,
        status,
        created_by: userId!,
      })
      .select("id")
      .single();
    if (error) throw error;
    return inserted.id;
  }

  const record = useMutation({
    mutationFn: () => saveBlast("draft"),
    onSuccess: () => {
      toast.success("Saved as draft — send it any time from Recent blasts");
      void queryClient.invalidateQueries({ queryKey: ["blast-data"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const blastNow = useMutation({
    mutationFn: async (existing?: BlastRow) => {
      const blastId = existing ? existing.id : await saveBlast("sending");
      return runSendBlast({ data: { blastId } });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["blast-data"] });
      const extras = [
        result.failed > 0 ? `${result.failed} failed` : null,
        result.invalidCount > 0 ? `${result.invalidCount} invalid` : null,
        result.duplicates > 0 ? `${result.duplicates} duplicates skipped` : null,
      ].filter(Boolean);
      const summary = `Blast sent to ${result.sent} of ${result.total} recipients${
        extras.length > 0 ? ` · ${extras.join(" · ")}` : ""
      }`;
      if (result.sent === 0) toast.error(summary);
      else toast.success(summary);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const whatsappStatus = useQuery({
    queryKey: ["whatsapp-status"],
    enabled: isOwner,
    queryFn: () => runWhatsappStatus({ data: undefined }),
  });

  const saveSettings = useMutation({
    mutationFn: () =>
      runSaveSettings({
        data: {
          phoneNumberId: phoneNumberId.trim(),
          accessToken: accessToken.trim(),
          wabaId: wabaId.trim() || null,
          verifyToken: verifyToken.trim() || null,
          isActive: true,
        },
      }),
    onSuccess: (result) => {
      setAccessToken("");
      void whatsappStatus.refetch();
      toast.success(
        `Connected${result.displayPhoneNumber ? ` as ${result.displayPhoneNumber}` : ""}`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const testConnection = useMutation({
    mutationFn: () => runTestConnection({ data: undefined }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Connection healthy${result.displayPhoneNumber ? ` · ${result.displayPhoneNumber}` : ""}`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const testBlast = useMutation({
    mutationFn: () =>
      runTestMessage({
        data: {
          phone: testNumber.trim(),
          message: message.trim(),
          attachments: attachmentList,
        },
      }),
    onSuccess: () => toast.success("Test message sent"),
    onError: (error: Error) => toast.error(error.message),
  });

  function openFirst() {
    const target = audience[0];
    if (!target) return;
    const text = encodeURIComponent(message.trim());
    if (channel === "whatsapp") {
      window.open(`https://wa.me/${target.phone.replace(/\D/g, "")}?text=${text}`, "_blank");
    } else if (channel === "sms") {
      window.location.href = `sms:${target.phone}?body=${text}`;
    } else {
      window.location.href = `mailto:?bcc=${audience.map((l) => l.phone).join(",")}&body=${text}`;
    }
  }

  return (
    <>
      <PageHeader
        title="Blast Studio"
        subtitle="Filter the audience, compose once and send across WhatsApp, SMS or email."
        action={
          <span className="glass rounded-full px-4 py-2 text-xs font-medium tracking-wide uppercase">
            {audience.length} recipients
          </span>
        }
      />

      {isOwner && (
        <Panel title="WhatsApp API settings">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {whatsappStatus.data?.configured
                ? `Connected sender ${whatsappStatus.data.phoneNumberId} · blasts send automatically through the WhatsApp Business Cloud API.`
                : "Add your WhatsApp Business Cloud API credentials to enable fully automated blasts. Credentials are stored server-side only."}
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                placeholder="Phone number ID"
                value={phoneNumberId}
                onChange={(event) => setPhoneNumberId(event.target.value)}
              />
              <Input
                placeholder="WABA ID (optional)"
                value={wabaId}
                onChange={(event) => setWabaId(event.target.value)}
              />
              <Input
                placeholder="Webhook verify token (optional)"
                value={verifyToken}
                onChange={(event) => setVerifyToken(event.target.value)}
              />
              <Input
                type="password"
                placeholder="Permanent access token"
                value={accessToken}
                onChange={(event) => setAccessToken(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="press"
                disabled={saveSettings.isPending}
                onClick={() => saveSettings.mutate()}
              >
                Save &amp; connect
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="press"
                disabled={testConnection.isPending}
                onClick={() => testConnection.mutate()}
              >
                Test connection
              </Button>
              <span className="glass rounded-full px-3 py-1.5 text-xs">
                {whatsappStatus.data?.configured ? "Connected" : "Not connected"}
              </span>
            </div>
          </div>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Compose">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              record.mutate();
            }}
          >
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setChannel(option.id)}
                  className={`press flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    channel === option.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <option.icon className="size-4" />
                  {option.label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={7}
                maxLength={2000}
                placeholder="New launch in Bandra West — 2 & 3 BHK residences with sea views. Reply for the price sheet."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="attachment">Attachment link (brochure, video, image)</Label>
              <Input
                id="attachment"
                value={attachment}
                onChange={(e) => setAttachment(e.target.value)}
                maxLength={500}
                placeholder="https://..."
              />
              <input
                ref={mediaInput}
                id="attachment-file"
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,.mp4,.mov,.m4v"
                className="hidden"
                onChange={(e) => void handleMedia(e.target.files)}
              />
              <Button
                type="button"
                variant="secondary"
                className="press w-full"
                disabled={uploadingMedia}
                onClick={() => mediaInput.current?.click()}
              >
                <Paperclip className="size-4" />
                {uploadingMedia ? "Uploading…" : "Attach PDF, image or video"}
              </Button>
              {uploads.length > 0 && (
                <ul className="space-y-1">
                  {uploads.map((file) => (
                    <li
                      key={file.url}
                      className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-1.5 text-xs"
                    >
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        className="press text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setUploads((prev) => prev.filter((row) => row.url !== file.url))
                        }
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="press flex-1"
                disabled={blastNow.isPending}
                onClick={() => blastNow.mutate(undefined)}
              >
                <Zap className="size-4" />
                {blastNow.isPending
                  ? "Sending…"
                  : `Blast now to ${audienceCheck.valid.length} number${
                      audienceCheck.valid.length === 1 ? "" : "s"
                    }`}
              </Button>
              <Button
                type="submit"
                variant="secondary"
                className="press"
                disabled={record.isPending}
              >
                <Send className="size-4" /> Save &amp; queue blast
              </Button>
              <Button type="button" variant="secondary" className="press" onClick={openFirst}>
                Open in {channel}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="max-w-[220px]"
                placeholder="Test number"
                value={testNumber}
                onChange={(event) => setTestNumber(event.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                className="press"
                disabled={testBlast.isPending || !testNumber.trim()}
                onClick={() => testBlast.mutate()}
              >
                Send test blast
              </Button>
              <span className="text-xs text-muted-foreground">
                {audienceCheck.valid.length} valid · {audienceCheck.invalid.length} invalid ·{" "}
                {audienceCheck.duplicates} duplicates
              </span>
            </div>
          </form>
        </Panel>

        <div className="space-y-4">
          <Panel title="Audience filter">
            <div className="space-y-3">
              {customRecipients.length > 0 && (
                <p className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                  Using your custom recipient list — these filters are paused.
                </p>
              )}
              <Chips
                label="Temperature"
                options={["all", "cold", "warm", "hot"]}
                value={temperature}
                onChange={setTemperature}
              />
              <Chips
                label="Locality"
                options={["all", ...LOCALITIES]}
                value={locality}
                onChange={setLocality}
              />
            </div>
          </Panel>

          <Panel
            title="Recipient numbers"
            action={
              customRecipients.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setManualNumbers("");
                    setImported([]);
                  }}
                  className="press flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" /> Clear
                </button>
              ) : undefined
            }
          >
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="manual-numbers">Enter numbers manually</Label>
                <Textarea
                  id="manual-numbers"
                  value={manualNumbers}
                  onChange={(e) => setManualNumbers(e.target.value)}
                  rows={4}
                  maxLength={200000}
                  placeholder={"Rahul Mehta, 9820012345\n9930098765"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipient-file">Import from file</Label>
                <input
                  ref={fileInput}
                  id="recipient-file"
                  type="file"
                  multiple
                  accept=".xlsx,.xls,.xlsm,.ods,.csv,.pdf,.txt,.tsv"
                  className="hidden"
                  onChange={(e) => void handleFiles(e.target.files)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="press w-full"
                  disabled={importing}
                  onClick={() => fileInput.current?.click()}
                >
                  <FileUp className="size-4" />
                  {importing ? "Reading file…" : "Upload Excel, CSV, PDF or text"}
                </Button>
              </div>

              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="size-3.5" />
                {customRecipients.length > 0
                  ? `${customRecipients.length} custom recipients ready`
                  : "Leave empty to blast the filtered lead audience."}
              </p>
            </div>
          </Panel>

          <Panel title="Recent blasts">
            {(data?.blasts ?? []).length === 0 ? (
              <Empty>No campaigns recorded yet.</Empty>
            ) : (
              <ul className="space-y-2">
                {(data?.blasts ?? []).map((blast) => (
                  <li key={blast.id} className="rounded-xl border border-border/70 px-3 py-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-medium capitalize">
                        {blast.channel}
                        <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[10px] tracking-wide uppercase">
                          {blast.status}
                        </span>
                      </span>
                      <span>
                        {blast.recipient_count} recipients ·{" "}
                        {new Date(blast.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm">{blast.message}</p>
                    {(blast.status === "sent" || blast.status === "failed") && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {blast.sent_count ?? 0} sent · {blast.failed_count ?? 0} failed ·{" "}
                        {blast.invalid_count ?? 0} invalid · {blast.duplicate_count ?? 0} duplicates
                      </p>
                    )}
                    {blast.send_error && (
                      <p className="mt-1 line-clamp-2 text-[11px] text-destructive">
                        {blast.send_error}
                      </p>
                    )}
                    {blast.status !== "sent" && (
                      <Button
                        type="button"
                        size="sm"
                        className="press mt-2"
                        disabled={blastNow.isPending}
                        onClick={() => blastNow.mutate(blast)}
                      >
                        <Zap className="size-3.5" /> Blast
                      </Button>
                    )}
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

function Chips({
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
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`press rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
              value === option
                ? "border-gold bg-gold text-gold-foreground"
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