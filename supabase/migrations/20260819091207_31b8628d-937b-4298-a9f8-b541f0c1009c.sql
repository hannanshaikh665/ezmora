CREATE POLICY "blast media insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'blast-media' AND owner = auth.uid());

CREATE POLICY "blast media read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'blast-media' AND (owner = auth.uid() OR private.is_manager(auth.uid())));

CREATE POLICY "blast media delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'blast-media' AND owner = auth.uid());