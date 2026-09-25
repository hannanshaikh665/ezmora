CREATE TABLE public.datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  location text,
  data_type text NOT NULL DEFAULT 'Cold Data',
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.datasets TO authenticated;
GRANT ALL ON public.datasets TO service_role;

CREATE TABLE public.dataset_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dataset_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dataset_assignments TO authenticated;
GRANT ALL ON public.dataset_assignments TO service_role;

ALTER TABLE public.contacts ADD COLUMN dataset_id uuid REFERENCES public.datasets(id) ON DELETE SET NULL;
CREATE INDEX contacts_dataset_id_idx ON public.contacts(dataset_id);

CREATE OR REPLACE FUNCTION private.can_access_dataset(_user_id uuid, _dataset_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT _dataset_id IS NOT NULL AND (
    private.is_manager(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.dataset_assignments da
      WHERE da.dataset_id = _dataset_id AND da.user_id = _user_id
    )
  );
$$;

ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "datasets read" ON public.datasets FOR SELECT TO authenticated
USING (private.is_manager(auth.uid()) OR created_by = auth.uid() OR EXISTS (
  SELECT 1 FROM public.dataset_assignments da
  WHERE da.dataset_id = datasets.id AND da.user_id = auth.uid()
));

CREATE POLICY "datasets insert" ON public.datasets FOR INSERT TO authenticated
WITH CHECK (private.is_manager(auth.uid()));

CREATE POLICY "datasets update" ON public.datasets FOR UPDATE TO authenticated
USING (private.is_manager(auth.uid())) WITH CHECK (private.is_manager(auth.uid()));

CREATE POLICY "datasets delete" ON public.datasets FOR DELETE TO authenticated
USING (private.is_manager(auth.uid()));

ALTER TABLE public.dataset_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dataset assignments read" ON public.dataset_assignments FOR SELECT TO authenticated
USING (private.is_manager(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "dataset assignments insert" ON public.dataset_assignments FOR INSERT TO authenticated
WITH CHECK (private.is_manager(auth.uid()));

CREATE POLICY "dataset assignments delete" ON public.dataset_assignments FOR DELETE TO authenticated
USING (private.is_manager(auth.uid()));

CREATE POLICY "contacts read via dataset" ON public.contacts FOR SELECT TO authenticated
USING (private.can_access_dataset(auth.uid(), dataset_id));

CREATE POLICY "contacts update via dataset" ON public.contacts FOR UPDATE TO authenticated
USING (private.can_access_dataset(auth.uid(), dataset_id))
WITH CHECK (private.can_access_dataset(auth.uid(), dataset_id));

CREATE TRIGGER datasets_touch BEFORE UPDATE ON public.datasets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();