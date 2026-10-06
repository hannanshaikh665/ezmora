DROP POLICY IF EXISTS "calls update own" ON public.calls;
CREATE POLICY "calls update own" ON public.calls
  FOR UPDATE TO authenticated
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());
