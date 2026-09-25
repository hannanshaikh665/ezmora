ALTER TABLE public.leads ADD COLUMN dataset_id uuid REFERENCES public.datasets(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN dataset_id uuid REFERENCES public.datasets(id) ON DELETE SET NULL;
CREATE INDEX leads_dataset_id_idx ON public.leads(dataset_id);
CREATE INDEX tasks_dataset_id_idx ON public.tasks(dataset_id);