import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const memberSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  fullName: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(20).optional(),
  designation: z.string().trim().max(60).optional(),
  branch: z.string().trim().max(60).optional(),
  role: z.enum(["supervisor", "employee"]),
});

const ownerSchema = memberSchema.omit({ role: true });

/** True when the firm still needs its first owner account. */
export const ownerExists = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "owner");
  return { exists: (count ?? 0) > 0 };
});

/** One-time bootstrap: creates the very first owner login. */
export const bootstrapOwner = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ownerSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "owner");
    if ((count ?? 0) > 0) throw new Error("An owner account already exists.");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create the owner.");

    await supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      full_name: data.fullName,
      email: data.email,
      phone: data.phone ?? null,
      designation: data.designation ?? "Owner",
      branch: data.branch ?? "Mumbai",
    });
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "owner" });
    return { ok: true };
  });

/** Owner-only: create a supervisor or sales employee login. */
export const createTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => memberSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: ownerRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "owner")
      .maybeSingle();
    const isOwner = Boolean(ownerRow);
    if (!isOwner) throw new Error("Only the owner can create logins.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create the login.");

    await supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      full_name: data.fullName,
      email: data.email,
      phone: data.phone ?? null,
      designation: data.designation ?? (data.role === "supervisor" ? "Supervisor" : "Sales"),
      branch: data.branch ?? "Mumbai",
    });
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    return { ok: true, id: created.user.id };
  });

/** Owner-only: reset a team member's password. */
export const resetMemberPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(8).max(72) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: ownerRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "owner")
      .maybeSingle();
    const isOwner = Boolean(ownerRow);
    if (!isOwner) throw new Error("Only the owner can reset passwords.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });