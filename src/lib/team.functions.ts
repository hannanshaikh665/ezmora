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
const userIdSchema = z.object({ userId: z.string().uuid() });
const passwordSchema = userIdSchema.extend({ password: z.string().min(8).max(72) });
const roleSchema = userIdSchema.extend({ role: z.enum(["supervisor", "employee"]) });

const BAN_DURATION = "876000h";

type AccessAction =
  | "password_reset"
  | "login_locked"
  | "login_unlocked"
  | "account_disabled"
  | "account_reactivated"
  | "login_removed"
  | "role_changed";

async function requireOwner(context: { supabase: any; userId: string }) {
  const { data: ownerRow } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "owner")
    .maybeSingle();
  if (!ownerRow) throw new Error("Only the owner can manage login access.");
}

async function audit(
  supabaseAdmin: any,
  actorId: string,
  targetUserId: string,
  action: AccessAction,
  details: Record<string, unknown> = {},
) {
  const { error } = await supabaseAdmin.from("access_audit_logs").insert({
    actor_id: actorId,
    target_user_id: targetUserId,
    action,
    details,
  });
  if (error) throw new Error(`Could not write access audit log: ${error.message}`);
}

async function assertManageableTarget(supabaseAdmin: any, actorId: string, targetUserId: string) {
  if (actorId === targetUserId) throw new Error("You cannot change your own owner access here.");
  const { data: targetRole } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (!targetRole || targetRole.role === "owner") {
    throw new Error("Only employee and supervisor logins can be managed here.");
  }
}

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

/** Owner-only: list login metadata from Supabase Auth and CRM profiles. */
export const listTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }, usersResult] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: true }),
        supabaseAdmin.from("user_roles").select("user_id, role"),
        supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ]);
    if (profilesError) throw new Error(profilesError.message);
    if (rolesError) throw new Error(rolesError.message);
    if (usersResult.error) throw new Error(usersResult.error.message);

    const roleMap = new Map((roles ?? []).map((row) => [row.user_id, row.role]));
    const authMap = new Map((usersResult.data.users ?? []).map((user) => [user.id, user]));
    return (profiles ?? []).map((profile) => {
      const authUser = authMap.get(profile.id);
      return {
        ...profile,
        role: roleMap.get(profile.id) ?? "employee",
        authCreatedAt: authUser?.created_at ?? profile.created_at,
        lastLoginAt: authUser?.last_sign_in_at ?? profile.last_login_at,
        lastActiveAt: profile.last_active_at,
      };
    });
  });

/** Owner-only: create a supervisor or sales employee login. */
export const createTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => memberSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
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
    await audit(supabaseAdmin, context.userId, created.user.id, "role_changed", {
      role: data.role,
      reason: "login_created",
    });
    return { ok: true, id: created.user.id };
  });

/** Owner-only: reset a team member's password. */
export const resetMemberPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => passwordSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertManageableTarget(supabaseAdmin, context.userId, data.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    await audit(supabaseAdmin, context.userId, data.userId, "password_reset");
    return { ok: true };
  });

/** Owner-only: lock a login and invalidate its active sessions. */
export const lockMemberLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => userIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertManageableTarget(supabaseAdmin, context.userId, data.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: BAN_DURATION,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.auth.admin.signOut(data.userId, "global");
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ access_status: "locked" })
      .eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);
    await audit(supabaseAdmin, context.userId, data.userId, "login_locked");
    return { ok: true };
  });

/** Owner-only: unlock a login. */
export const unlockMemberLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => userIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertManageableTarget(supabaseAdmin, context.userId, data.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: "none",
    });
    if (error) throw new Error(error.message);
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ access_status: "active" })
      .eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);
    await audit(supabaseAdmin, context.userId, data.userId, "login_unlocked");
    return { ok: true };
  });

/** Owner-only: disable a login while preserving all CRM records. */
export const disableMemberLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => userIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertManageableTarget(supabaseAdmin, context.userId, data.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: BAN_DURATION,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.auth.admin.signOut(data.userId, "global");
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ access_status: "disabled" })
      .eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);
    await audit(supabaseAdmin, context.userId, data.userId, "account_disabled");
    return { ok: true };
  });

/** Owner-only: reactivate a disabled login without changing CRM history. */
export const reactivateMemberLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => userIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertManageableTarget(supabaseAdmin, context.userId, data.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: "none",
    });
    if (error) throw new Error(error.message);
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ access_status: "active" })
      .eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);
    await audit(supabaseAdmin, context.userId, data.userId, "account_reactivated");
    return { ok: true };
  });

/** Owner-only: remove only authentication access; CRM records remain. */
export const deleteMemberLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => userIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertManageableTarget(supabaseAdmin, context.userId, data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ access_status: "login_removed" })
      .eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);
    await audit(supabaseAdmin, context.userId, data.userId, "login_removed");
    return { ok: true };
  });

/** Owner-only: change an employee/supervisor role. */
export const changeMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => roleSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertManageableTarget(supabaseAdmin, context.userId, data.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .update({ role: data.role })
      .eq("user_id", data.userId)
      .in("role", ["employee", "supervisor"]);
    if (error) throw new Error(error.message);
    await audit(supabaseAdmin, context.userId, data.userId, "role_changed", {
      role: data.role,
    });
    return { ok: true };
  });
