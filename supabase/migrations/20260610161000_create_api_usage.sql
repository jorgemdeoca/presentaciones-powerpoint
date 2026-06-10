-- Create api_usage table to track token limits and consumption
CREATE TABLE public.api_usage (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    date date NOT NULL DEFAULT current_date,
    provider text NOT NULL,
    tokens_used integer NOT NULL DEFAULT 0,
    requests_used integer NOT NULL DEFAULT 0,
    limit_tokens integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT api_usage_pkey PRIMARY KEY (id),
    CONSTRAINT api_usage_date_provider_key UNIQUE (date, provider)
);

-- Enable RLS
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view the usage
CREATE POLICY "Allow authenticated users to view api usage" ON public.api_usage
    FOR SELECT
    TO authenticated
    USING (true);

-- Create a secure RPC to increment token usage
CREATE OR REPLACE FUNCTION increment_api_usage(
  p_provider text,
  p_tokens_used integer,
  p_requests_used integer,
  p_limit_tokens integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.api_usage (date, provider, tokens_used, requests_used, limit_tokens)
  VALUES (current_date, p_provider, p_tokens_used, p_requests_used, p_limit_tokens)
  ON CONFLICT (date, provider)
  DO UPDATE SET
    tokens_used = public.api_usage.tokens_used + EXCLUDED.tokens_used,
    requests_used = public.api_usage.requests_used + EXCLUDED.requests_used,
    limit_tokens = EXCLUDED.limit_tokens,
    updated_at = now();
END;
$$;
