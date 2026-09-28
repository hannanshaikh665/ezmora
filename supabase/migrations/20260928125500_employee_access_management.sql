-- Owner-controlled employee/supervisor access management.
-- CRM records remain intact when a login is disabled or removed.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_status text NOT NULL DEFAULT 'active'
    CHECK (access_status IN ('active', 'locked', 'disabled', 'login_removed')),
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_access_status_idx ON public.profiles (access_status);

CREATE TABLE IF NOT EXISTS public.access_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN (
    'password_reset',
    'login_locked',
    'login_unlocked',
    'account_disabled',
    'account_reactivated',
    'login_removed',
    'role_changed'
  )),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS access_audit_logs_target_idx
  ON public.access_audit_logs (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS access_audit_logs_actor_idx
  ON public.access_audit_logs (actor_id, created_at DESC);

GRANT SELECT ON public.access_audit_logs TO authenticated;
GRANT ALL ON public.access_audit_logs TO service_role;
ALTER TABLE public.access_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners read access audit logs" ON public.access_audit_logs;
CREATE POLICY "owners read access audit logs"
  ON public.access_audit_logs
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "owners insert access audit logs" ON public.access_audit_logs;
CREATE POLICY "owners insert access audit logs"
  ON public.access_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'owner') AND actor_id = auth.uid());

COMMENT ON COLUMN public.profiles.access_status IS
  'Authentication access state; CRM history is retained for every state.';
COMMENT ON TABLE public.access_audit_logs IS
  'Owner-only audit history for login and role administration.';
