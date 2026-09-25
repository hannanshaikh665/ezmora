
-- WhatsApp sender settings (credentials are server-only; no authenticated access)
CREATE TABLE public.whatsapp_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  provider text NOT NULL DEFAULT 'meta',
  phone_number_id text,
  waba_id text,
  access_token text,
  verify_token text,
  is_active boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.whatsapp_settings TO service_role;
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

-- Per-recipient delivery tracking
CREATE TABLE public.blast_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blast_id uuid NOT NULL REFERENCES public.blasts(id) ON DELETE CASCADE,
  name text,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  message_id text,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blast_id, phone)
);
CREATE INDEX blast_recipients_blast_idx ON public.blast_recipients(blast_id);
CREATE INDEX blast_recipients_message_idx ON public.blast_recipients(message_id);

GRANT SELECT ON public.blast_recipients TO authenticated;
GRANT ALL ON public.blast_recipients TO service_role;
ALTER TABLE public.blast_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blast recipients read" ON public.blast_recipients
  FOR SELECT TO authenticated
  USING (
    private.is_manager(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.blasts b
      WHERE b.id = blast_recipients.blast_id AND b.created_by = auth.uid()
    )
  );

CREATE TRIGGER blast_recipients_touch BEFORE UPDATE ON public.blast_recipients
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.blasts
  ADD COLUMN IF NOT EXISTS invalid_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duplicate_count integer NOT NULL DEFAULT 0;
