import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const settingsSchema = z.object({
  phoneNumberId: z.string().trim().min(3).max(64),
  accessToken: z.string().trim().min(20).max(1000),
  wabaId: z.string().trim().max(64).optional().nullable(),
  verifyToken: z.string().trim().max(200).optional().nullable(),
  isActive: z.boolean().default(true),
});

const testSchema = z.object({
  phone: z.string().trim().min(6).max(24),
  message: z.string().max(4000),
  attachments: z.array(z.string().url()).max(10),
});

async function assertOwner(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "owner")
    .maybeSingle();
  if (!data) throw new Error("Only the owner can manage WhatsApp API settings.");
}

/** Owner-only: current sender status. Never returns the access token. */
export const getWhatsappStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("whatsapp_settings")
      .select("phone_number_id, waba_id, is_active, updated_at")
      .eq("id", true)
      .maybeSingle();
    return {
      configured: Boolean(data?.phone_number_id),
      phoneNumberId: data?.phone_number_id ?? null,
      wabaId: data?.waba_id ?? null,
      isActive: data?.is_active ?? false,
      updatedAt: data?.updated_at ?? null,
    };
  });

/** Owner-only: store Cloud API credentials server-side. */
export const saveWhatsappSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => settingsSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifySender } = await import("@/lib/whatsapp.server");

    const check = await verifySender(data.phoneNumberId, data.accessToken);
    if (!check.ok) throw new Error(check.error);

    const { error } = await supabaseAdmin.from("whatsapp_settings").upsert(
      {
        id: true,
        provider: "meta",
        phone_number_id: data.phoneNumberId,
        access_token: data.accessToken,
        waba_id: data.wabaId ?? null,
        verify_token: data.verifyToken ?? null,
        is_active: data.isActive,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(error.message);

    return {
      ok: true as const,
      displayPhoneNumber: check.displayPhoneNumber,
      verifiedName: check.verifiedName,
    };
  });

/** Owner-only: re-check the saved credentials against WhatsApp. */
export const testWhatsappConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const { loadSettings, verifySender } = await import("@/lib/whatsapp.server");
    const settings = await loadSettings();
    if (!settings) return { ok: false as const, error: "No credentials saved yet." };
    const check = await verifySender(settings.phone_number_id, settings.access_token);
    if (!check.ok) return { ok: false as const, error: check.error };
    return {
      ok: true as const,
      displayPhoneNumber: check.displayPhoneNumber,
      verifiedName: check.verifiedName,
      qualityRating: check.qualityRating,
    };
  });

/** Sends the composed content to one test number before a mass blast. */
export const sendTestMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => testSchema.parse(data))
  .handler(async ({ data }) => {
    const { runTestSend } = await import("@/lib/whatsapp.server");
    return runTestSend(data.phone, data.message, data.attachments);
  });
