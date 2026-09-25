import { createFileRoute } from "@tanstack/react-router";

/**
 * WhatsApp Cloud API webhook: verifies Meta's challenge and records
 * delivery/read/failure updates against each blast recipient.
 */
export const Route = createFileRoute("/api/public/whatsapp-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge") ?? "";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("whatsapp_settings")
          .select("verify_token")
          .eq("id", true)
          .maybeSingle();

        if (mode === "subscribe" && token && data?.verify_token && token === data.verify_token) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        type Status = {
          id?: string;
          status?: string;
          errors?: { title?: string; message?: string }[];
        };
        const entries = (payload as { entry?: { changes?: { value?: { statuses?: Status[] } }[] }[] })
          .entry;

        const statuses: Status[] = [];
        for (const entry of entries ?? []) {
          for (const change of entry.changes ?? []) {
            for (const status of change.value?.statuses ?? []) statuses.push(status);
          }
        }

        if (statuses.length === 0) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const allowed = new Set(["sent", "delivered", "read", "failed"]);

        for (const status of statuses) {
          if (!status.id || !status.status || !allowed.has(status.status)) continue;
          const error = status.errors?.[0];
          await supabaseAdmin
            .from("blast_recipients")
            .update({
              status: status.status,
              error: error ? `${error.title ?? ""} ${error.message ?? ""}`.trim().slice(0, 1000) : null,
            })
            .eq("message_id", status.id);
        }

        return new Response("ok");
      },
    },
  },
});
