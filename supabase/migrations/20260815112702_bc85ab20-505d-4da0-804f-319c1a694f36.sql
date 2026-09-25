CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION private.is_manager(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('owner','supervisor')) $$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_manager(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_manager(uuid) TO authenticated, service_role;

-- blasts
DROP POLICY IF EXISTS "blasts read" ON public.blasts;
CREATE POLICY "blasts read" ON public.blasts FOR SELECT TO authenticated
  USING (private.is_manager(auth.uid()) OR created_by = auth.uid());
DROP POLICY IF EXISTS "blasts update" ON public.blasts;
CREATE POLICY "blasts update" ON public.blasts FOR UPDATE TO authenticated
  USING (private.is_manager(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (private.is_manager(auth.uid()) OR created_by = auth.uid());

-- calls
DROP POLICY IF EXISTS "calls read" ON public.calls;
CREATE POLICY "calls read" ON public.calls FOR SELECT TO authenticated
  USING (private.is_manager(auth.uid()) OR employee_id = auth.uid());

-- contacts
DROP POLICY IF EXISTS "contacts delete" ON public.contacts;
CREATE POLICY "contacts delete" ON public.contacts FOR DELETE TO authenticated
  USING (private.is_manager(auth.uid()));
DROP POLICY IF EXISTS "contacts read" ON public.contacts;
CREATE POLICY "contacts read" ON public.contacts FOR SELECT TO authenticated
  USING (private.is_manager(auth.uid()) OR assigned_to = auth.uid());
DROP POLICY IF EXISTS "contacts update" ON public.contacts;
CREATE POLICY "contacts update" ON public.contacts FOR UPDATE TO authenticated
  USING (private.is_manager(auth.uid()) OR assigned_to = auth.uid())
  WITH CHECK (private.is_manager(auth.uid()) OR assigned_to = auth.uid());

-- leads
DROP POLICY IF EXISTS "leads delete" ON public.leads;
CREATE POLICY "leads delete" ON public.leads FOR DELETE TO authenticated
  USING (private.is_manager(auth.uid()));
DROP POLICY IF EXISTS "leads read" ON public.leads;
CREATE POLICY "leads read" ON public.leads FOR SELECT TO authenticated
  USING (private.is_manager(auth.uid()) OR assigned_to = auth.uid() OR created_by = auth.uid());
DROP POLICY IF EXISTS "leads update" ON public.leads;
CREATE POLICY "leads update" ON public.leads FOR UPDATE TO authenticated
  USING (private.is_manager(auth.uid()) OR assigned_to = auth.uid())
  WITH CHECK (private.is_manager(auth.uid()) OR assigned_to = auth.uid());

-- profiles: restrict reads to self or managers
DROP POLICY IF EXISTS "profiles readable by signed in" ON public.profiles;
CREATE POLICY "profiles read self or manager" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR private.is_manager(auth.uid()));
DROP POLICY IF EXISTS "profiles insert self" ON public.profiles;
CREATE POLICY "profiles insert self" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR private.is_manager(auth.uid()));
DROP POLICY IF EXISTS "profiles self update" ON public.profiles;
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR private.is_manager(auth.uid()))
  WITH CHECK (id = auth.uid() OR private.is_manager(auth.uid()));

-- projects
DROP POLICY IF EXISTS "projects delete" ON public.projects;
CREATE POLICY "projects delete" ON public.projects FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.app_role));
DROP POLICY IF EXISTS "projects update" ON public.projects;
CREATE POLICY "projects update" ON public.projects FOR UPDATE TO authenticated
  USING (private.is_manager(auth.uid())) WITH CHECK (private.is_manager(auth.uid()));

-- site_visits
DROP POLICY IF EXISTS "visits read" ON public.site_visits;
CREATE POLICY "visits read" ON public.site_visits FOR SELECT TO authenticated
  USING (private.is_manager(auth.uid()) OR assigned_to = auth.uid() OR created_by = auth.uid());
DROP POLICY IF EXISTS "visits update" ON public.site_visits;
CREATE POLICY "visits update" ON public.site_visits FOR UPDATE TO authenticated
  USING (private.is_manager(auth.uid()) OR assigned_to = auth.uid())
  WITH CHECK (private.is_manager(auth.uid()) OR assigned_to = auth.uid());
DROP POLICY IF EXISTS "visits delete" ON public.site_visits;
CREATE POLICY "visits delete" ON public.site_visits FOR DELETE TO authenticated
  USING (private.is_manager(auth.uid()));

-- tasks
DROP POLICY IF EXISTS "tasks delete" ON public.tasks;
CREATE POLICY "tasks delete" ON public.tasks FOR DELETE TO authenticated
  USING (private.is_manager(auth.uid()) OR created_by = auth.uid());
DROP POLICY IF EXISTS "tasks read" ON public.tasks;
CREATE POLICY "tasks read" ON public.tasks FOR SELECT TO authenticated
  USING (private.is_manager(auth.uid()) OR assigned_to = auth.uid() OR created_by = auth.uid());
DROP POLICY IF EXISTS "tasks update" ON public.tasks;
CREATE POLICY "tasks update" ON public.tasks FOR UPDATE TO authenticated
  USING (private.is_manager(auth.uid()) OR assigned_to = auth.uid())
  WITH CHECK (private.is_manager(auth.uid()) OR assigned_to = auth.uid());

-- user_roles: own rows or managers
DROP POLICY IF EXISTS "roles readable by signed in" ON public.user_roles;
CREATE POLICY "roles read self or manager" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_manager(auth.uid()));

-- remove publicly callable definer helpers
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_manager(uuid);