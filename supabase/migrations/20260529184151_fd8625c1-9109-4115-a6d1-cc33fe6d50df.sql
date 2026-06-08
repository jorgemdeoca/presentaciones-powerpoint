
ALTER TABLE public.presentations
  ADD COLUMN IF NOT EXISTS generation_step text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS generation_error text;

ALTER TABLE public.slides
  ADD COLUMN IF NOT EXISTS design jsonb NOT NULL DEFAULT '{}'::jsonb;
