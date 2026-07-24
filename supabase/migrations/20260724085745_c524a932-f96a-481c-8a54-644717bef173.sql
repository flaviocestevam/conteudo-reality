CREATE TABLE public.daily_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_date date NOT NULL UNIQUE,
  model text NOT NULL,
  content jsonb NOT NULL,
  raw_text text,
  sinapse_config jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_scripts TO anon, authenticated;
GRANT ALL ON public.daily_scripts TO service_role;

ALTER TABLE public.daily_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY open_all_daily_scripts ON public.daily_scripts FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER daily_scripts_set_updated_at
BEFORE UPDATE ON public.daily_scripts
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();