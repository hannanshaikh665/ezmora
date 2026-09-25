// Server-only WhatsApp Cloud API (Meta) engine. Credentials never leave the server.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { cleanRecipients, mediaKind } from "@/lib/phone";

const GRAPH = "https://graph.facebook.com/v21.0";

export type WhatsappSettings = {
  phone_number_id: string;
  access_token: string;
  waba_id: string | null;
  is_active: boolean;
};

export async function loadSettings(): Promise<WhatsappSettings | null> {
  const { data } = await supabaseAdmin
    .from("whatsapp_settings")
    .select("phone_number_id, access_token, waba_id, is_active")
    .eq("id", true)
    .maybeSingle();
  if (!data?.phone_number_id || !data?.access_token) return null;
  return data as WhatsappSettings;
}

/** Verifies credentials by reading the sender phone number from the Graph API. */
export async function verifySender(phoneNumberId: string, accessToken: string) {
  const response = await fetch(
    `${GRAPH}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,quality_rating`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const body = await response.text();
  if (!response.ok) {
    console.error(`WhatsApp verify failed [${response.status}]: ${body}`);
    return { ok: false as const, error: `WhatsApp rejected the credentials [${response.status}]: ${body}` };
  }
  const parsed = JSON.parse(body) as {
    display_phone_number?: string;
    verified_name?: string;
    quality_rating?: string;
  };
  return {
    ok: true as const,
    displayPhoneNumber: parsed.display_phone_number ?? null,
    verifiedName: parsed.verified_name ?? null,
    qualityRating: parsed.quality_rating ?? null,
  };
}

type SendPayload = Record<string, unknown>;

async function postMessage(settings: WhatsappSettings, payload: SendPayload) {
  const url = `${GRAPH}/${encodeURIComponent(settings.phone_number_id)}/messages`;
  let lastError = "";

  // Retry on rate limits and transient upstream failures.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    });
    const text = await response.text();

    if (response.ok) {
      const parsed = JSON.parse(text) as { messages?: { id?: string }[] };
      return { ok: true as const, messageId: parsed.messages?.[0]?.id ?? null };
    }

    lastError = `WhatsApp API error [${response.status}]: ${text}`;
    console.error(lastError);
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable) break;
    await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
  }

  return { ok: false as const, error: lastError };
}

export type BlastAttachment = { url: string; kind: "image" | "video" | "document" | "audio" };

export function buildAttachments(urls: string[]) {
  const supported: BlastAttachment[] = [];
  const unsupported: string[] = [];
  for (const url of urls) {
    const kind = mediaKind(url);
    if (kind) supported.push({ url, kind });
    else unsupported.push(url);
  }
  return { supported, unsupported };
}

function fileNameFor(url: string) {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "attachment");
  } catch {
    return "attachment";
  }
}

/** Sends one recipient's full message: every attachment plus the text body. */
async function sendToRecipient(
  settings: WhatsappSettings,
  phone: string,
  message: string,
  attachments: BlastAttachment[],
) {
  let messageId: string | null = null;

  for (let index = 0; index < attachments.length; index += 1) {
    const media = attachments[index]!;
    const payload: SendPayload = {
      to: phone,
      type: media.kind,
      [media.kind]: {
        link: media.url,
        ...(media.kind === "document" ? { filename: fileNameFor(media.url) } : {}),
        ...(index === 0 && message && media.kind !== "audio" ? { caption: message.slice(0, 1024) } : {}),
      },
    };
    const result = await postMessage(settings, payload);
    if (!result.ok) return result;
    messageId = result.messageId ?? messageId;
  }

  const captionCarriedMessage =
    attachments.length > 0 && attachments[0]!.kind !== "audio" && message.length <= 1024;

  if (message && !captionCarriedMessage) {
    const result = await postMessage(settings, {
      to: phone,
      type: "text",
      text: { body: message, preview_url: true },
    });
    if (!result.ok) return result;
    messageId = result.messageId ?? messageId;
  }

  return { ok: true as const, messageId };
}

export type BlastRun = {
  sent: number;
  failed: number;
  total: number;
  invalid: { phone: string; reason: string }[];
  duplicates: number;
};

/**
 * Sends a whole blast automatically: validates and de-duplicates numbers,
 * tracks every recipient row, throttles to respect rate limits and records
 * failures with their reason for later retry.
 */
export async function runBlast(options: {
  blastId: string;
  message: string;
  attachmentUrls: string[];
  recipients: { name?: string | null; phone?: string | null }[];
}): Promise<BlastRun> {
  const settings = await loadSettings();
  if (!settings) {
    throw new Error(
      "No WhatsApp sender is connected. Open WhatsApp API settings and save your Cloud API credentials first.",
    );
  }

  const { valid, invalid, duplicates } = cleanRecipients(options.recipients);
  if (valid.length === 0) {
    throw new Error("No valid phone numbers in this recipient list.");
  }

  const { supported, unsupported } = buildAttachments(options.attachmentUrls);
  if (unsupported.length > 0) {
    throw new Error(
      `Unsupported attachment: ${unsupported[0]}. Use images, videos, audio or documents reachable over https.`,
    );
  }
  if (!options.message.trim() && supported.length === 0) {
    throw new Error("Add a message or at least one attachment before blasting.");
  }

  // Duplicate-send protection: skip recipients already delivered for this blast.
  const { data: existing } = await supabaseAdmin
    .from("blast_recipients")
    .select("phone, status")
    .eq("blast_id", options.blastId);
  const alreadyDone = new Set(
    (existing ?? [])
      .filter((row) => ["sent", "delivered", "read"].includes(row.status))
      .map((row) => row.phone),
  );

  await supabaseAdmin.from("blast_recipients").upsert(
    valid.map((row) => ({
      blast_id: options.blastId,
      name: row.name,
      phone: row.phone,
      status: alreadyDone.has(row.phone) ? "sent" : "pending",
    })),
    { onConflict: "blast_id,phone", ignoreDuplicates: false },
  );

  let sent = alreadyDone.size;
  let failed = 0;
  let lastError = "";

  for (const row of valid) {
    if (alreadyDone.has(row.phone)) continue;

    await supabaseAdmin
      .from("blast_recipients")
      .update({ status: "sending" })
      .eq("blast_id", options.blastId)
      .eq("phone", row.phone);

    const result = await sendToRecipient(settings, row.phone, options.message.trim(), supported);

    if (result.ok) {
      sent += 1;
      await supabaseAdmin
        .from("blast_recipients")
        .update({
          status: "sent",
          message_id: result.messageId,
          error: null,
          sent_at: new Date().toISOString(),
        })
        .eq("blast_id", options.blastId)
        .eq("phone", row.phone);
    } else {
      failed += 1;
      lastError = result.error;
      await supabaseAdmin
        .from("blast_recipients")
        .update({ status: "failed", error: result.error.slice(0, 1000) })
        .eq("blast_id", options.blastId)
        .eq("phone", row.phone);
    }

    // Gentle pacing to stay inside Cloud API throughput limits.
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  for (const bad of invalid) {
    await supabaseAdmin.from("blast_recipients").upsert(
      {
        blast_id: options.blastId,
        phone: bad.phone,
        status: "failed",
        error: bad.reason,
      },
      { onConflict: "blast_id,phone" },
    );
  }

  await supabaseAdmin
    .from("blasts")
    .update({
      status: sent > 0 ? "sent" : "failed",
      sent_at: new Date().toISOString(),
      sent_count: sent,
      failed_count: failed + invalid.length,
      invalid_count: invalid.length,
      duplicate_count: duplicates,
      send_error: lastError ? lastError.slice(0, 1000) : null,
    })
    .eq("id", options.blastId);

  return { sent, failed, total: valid.length, invalid, duplicates };
}

/** Sends the blast content to a single test number without touching the campaign. */
export async function runTestSend(phone: string, message: string, attachmentUrls: string[]) {
  const settings = await loadSettings();
  if (!settings) throw new Error("Connect a WhatsApp sender first.");

  const { valid, invalid } = cleanRecipients([{ phone }]);
  if (valid.length === 0) throw new Error(invalid[0]?.reason ?? "Invalid test number.");

  const { supported, unsupported } = buildAttachments(attachmentUrls);
  if (unsupported.length > 0) throw new Error(`Unsupported attachment: ${unsupported[0]}`);
  if (!message.trim() && supported.length === 0) {
    throw new Error("Add a message or an attachment before testing.");
  }

  const result = await sendToRecipient(settings, valid[0]!.phone, message.trim(), supported);
  if (!result.ok) throw new Error(result.error);
  return { ok: true as const, messageId: result.messageId };
}
