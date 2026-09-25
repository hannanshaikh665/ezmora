CREATE POLICY "whatsapp settings no client access" ON public.whatsapp_settings
  FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);