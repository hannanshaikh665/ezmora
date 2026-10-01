ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS device_call_id text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'crm';

CREATE UNIQUE INDEX IF NOT EXISTS calls_employee_device_call_idx
  ON public.calls (employee_id, device_call_id)
  WHERE device_call_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS calls_source_created_idx
  ON public.calls (source, created_at DESC);
