
CREATE TABLE public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  drive_folder_id text,
  drive_root_name text NOT NULL DEFAULT 'ATLAS-Capturas',
  sinapse_weekday smallint NOT NULL DEFAULT 0,
  sinapse_config jsonb NOT NULL DEFAULT '{"name":"Dra. Sinapse","tone":"Apresentadora reflexiva do reality — inteligente, curiosa, elegantemente irônica. Aparece apenas 1x por semana para olhar padrões da semana.","rules":"Português do Brasil. Máximo 4 frases. Nunca revela regras do jogo. Nunca insulta participantes. Nunca aparece nos dias normais."}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO anon, authenticated;
GRANT ALL ON public.settings TO service_role;

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY open_all_settings ON public.settings FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER settings_set_updated_at
BEFORE UPDATE ON public.settings
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;
