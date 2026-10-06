-- Harden the existing EZMORA calls table without changing its established schema.
-- Browser-only calls and historical native rows both use duration_seconds.
ALTER TABLE public.calls
  ADD CONSTRAINT calls_duration_seconds_nonnegative
  CHECK (duration_seconds >= 0);
