import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idSchema = z.object({ blastId: z.string().uuid() });
const markSchema = z.object({
  blastId: z.string().uuid(),
  sentCount: z.number().int().min(0).max(100000),
  failedCount: z.number().int().min(0).max(100000),
});

type Recipient = { name?: string | null; phone?: string | null };

/**
 * Sends a saved blast automatically through the WhatsApp Business Cloud API.
 * Validates and de-duplicates numbers, skips already delivered recipients,
 * paces requests for rate limits, retries transient failures and records the
 * failure reason for every recipient that could not be delivered.
 */
export const sendBlast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: blast, error } = await context.supabase
      .from("blasts")
      .select("*")
      .eq("id", data.blastId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!blast) throw new Error("Blast not found.");

    const recipients = (Array.isArray(blast.recipients) ? blast.recipients : []) as Recipient[];
    const attachments = (Array.isArray(blast.attachments) ? blast.attachments : []).filter(
      (url): url is string => typeof url === "string" && url.length > 0,
    );

    if (blast.channel !== "whatsapp") {
      throw new Error(
        "Automatic sending is available on the WhatsApp channel. Switch the channel to WhatsApp and blast again.",
      );
    }

    const { runBlast } = await import("@/lib/whatsapp.server");
    const result = await runBlast({
      blastId: blast.id,
      message: blast.message ?? "",
      attachmentUrls: attachments,
      recipients,
    });

    return {
      provider: "whatsapp" as const,
      sent: result.sent,
      failed: result.failed,
      total: result.total,
      invalid: result.invalid.slice(0, 20),
      invalidCount: result.invalid.length,
      duplicates: result.duplicates,
    };
  });

/** Records the outcome of a blast that was completed outside the API. */
export const markBlastSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => markSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("blasts")
      .update({
        status: data.sentCount > 0 ? "sent" : "draft",
        sent_at: data.sentCount > 0 ? new Date().toISOString() : null,
        sent_count: data.sentCount,
        failed_count: data.failedCount,
      })
      .eq("id", data.blastId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
