CREATE TYPE public.app_role AS ENUM ('owner','supervisor','employee');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  designation text,
  branch text DEFAULT 'Mumbai',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('owner','supervisor'))
$$;

CREATE POLICY "profiles readable by signed in" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_manager(auth.uid())) WITH CHECK (id = auth.uid() OR public.is_manager(auth.uid()));
CREATE POLICY "profiles insert self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid() OR public.is_manager(auth.uid()));
CREATE POLICY "roles readable by signed in" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  locality text,
  rera_number text,
  rera_valid_till date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects read" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "projects write" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "projects update" ON public.projects FOR UPDATE TO authenticated USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));
CREATE POLICY "projects delete" ON public.projects FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'owner'));

CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  phone text NOT NULL,
  source text DEFAULT 'Upload',
  status text NOT NULL DEFAULT 'new',
  assigned_to uuid,
  assigned_at timestamptz,
  created_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contacts_assigned_idx ON public.contacts (assigned_to, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts read" ON public.contacts FOR SELECT TO authenticated USING (public.is_manager(auth.uid()) OR assigned_to = auth.uid());
CREATE POLICY "contacts insert" ON public.contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "contacts update" ON public.contacts FOR UPDATE TO authenticated USING (public.is_manager(auth.uid()) OR assigned_to = auth.uid()) WITH CHECK (public.is_manager(auth.uid()) OR assigned_to = auth.uid());
CREATE POLICY "contacts delete" ON public.contacts FOR DELETE TO authenticated USING (public.is_manager(auth.uid()));

CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL,
  phone text,
  connected boolean NOT NULL DEFAULT false,
  duration_seconds integer NOT NULL DEFAULT 0,
  outcome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX calls_employee_idx ON public.calls (employee_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calls read" ON public.calls FOR SELECT TO authenticated USING (public.is_manager(auth.uid()) OR employee_id = auth.uid());
CREATE POLICY "calls insert" ON public.calls FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid());

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  name text,
  phone text NOT NULL,
  looking_for text,
  configuration text,
  budget text,
  locality text,
  temperature text NOT NULL DEFAULT 'warm',
  stage text NOT NULL DEFAULT 'new',
  follow_up_at timestamptz,
  notes text,
  assigned_to uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leads_assigned_idx ON public.leads (assigned_to, stage);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads read" ON public.leads FOR SELECT TO authenticated USING (public.is_manager(auth.uid()) OR assigned_to = auth.uid() OR created_by = auth.uid());
CREATE POLICY "leads insert" ON public.leads FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "leads update" ON public.leads FOR UPDATE TO authenticated USING (public.is_manager(auth.uid()) OR assigned_to = auth.uid()) WITH CHECK (public.is_manager(auth.uid()) OR assigned_to = auth.uid());
CREATE POLICY "leads delete" ON public.leads FOR DELETE TO authenticated USING (public.is_manager(auth.uid()));

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  title text NOT NULL,
  task_type text NOT NULL DEFAULT 'follow up',
  due_at timestamptz,
  project text,
  status text NOT NULL DEFAULT 'open',
  missed_reason text,
  assigned_to uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tasks_assigned_idx ON public.tasks (assigned_to, status, due_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks read" ON public.tasks FOR SELECT TO authenticated USING (public.is_manager(auth.uid()) OR assigned_to = auth.uid() OR created_by = auth.uid());
CREATE POLICY "tasks insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tasks update" ON public.tasks FOR UPDATE TO authenticated USING (public.is_manager(auth.uid()) OR assigned_to = auth.uid()) WITH CHECK (public.is_manager(auth.uid()) OR assigned_to = auth.uid());
CREATE POLICY "tasks delete" ON public.tasks FOR DELETE TO authenticated USING (public.is_manager(auth.uid()) OR created_by = auth.uid());

CREATE TABLE public.site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  project text,
  visit_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  feedback text,
  sentiment text,
  likelihood text,
  assigned_to uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_visits TO authenticated;
GRANT ALL ON public.site_visits TO service_role;
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visits read" ON public.site_visits FOR SELECT TO authenticated USING (public.is_manager(auth.uid()) OR assigned_to = auth.uid() OR created_by = auth.uid());
CREATE POLICY "visits insert" ON public.site_visits FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "visits update" ON public.site_visits FOR UPDATE TO authenticated USING (public.is_manager(auth.uid()) OR assigned_to = auth.uid()) WITH CHECK (public.is_manager(auth.uid()) OR assigned_to = auth.uid());

CREATE TABLE public.blasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  message text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  recipient_count integer NOT NULL DEFAULT 0,
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blasts TO authenticated;
GRANT ALL ON public.blasts TO service_role;
ALTER TABLE public.blasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blasts read" ON public.blasts FOR SELECT TO authenticated USING (public.is_manager(auth.uid()) OR created_by = auth.uid());
CREATE POLICY "blasts insert" ON public.blasts FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "blasts update" ON public.blasts FOR UPDATE TO authenticated USING (public.is_manager(auth.uid()) OR created_by = auth.uid()) WITH CHECK (public.is_manager(auth.uid()) OR created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER leads_touch BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.projects (name, locality, rera_number, rera_valid_till) VALUES
 ('Ezmora Vista Heights','Andheri','P51800012345','2027-12-31'),
 ('Ezmora Marine Crest','Prabhadevi','P51800067890','2028-06-30'),
 ('Ezmora Skyline Bandra','Bandra','P51800054321','2027-03-31'),
 ('Ezmora Grand Borivali','Borivali','P51800099887','2029-01-31');