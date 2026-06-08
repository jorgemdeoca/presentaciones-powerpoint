-- Ejecuta ESTE script en Supabase → SQL Editor si ves:
-- "column presentations.generation_step does not exist"
--
-- Es seguro ejecutarlo varias veces (usa IF NOT EXISTS).

ALTER TABLE public.presentations
  ADD COLUMN IF NOT EXISTS generation_step TEXT DEFAULT 'ready';

ALTER TABLE public.presentations
  ADD COLUMN IF NOT EXISTS generation_error TEXT;

ALTER TABLE public.slides
  ADD COLUMN IF NOT EXISTS design JSONB DEFAULT '{}'::jsonb;

-- Opcional: constraint de posición única por presentación
ALTER TABLE public.slides
  DROP CONSTRAINT IF EXISTS slides_presentation_position_unique;
ALTER TABLE public.slides
  ADD CONSTRAINT slides_presentation_position_unique UNIQUE (presentation_id, position);
