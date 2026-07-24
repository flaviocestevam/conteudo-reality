
CREATE TABLE public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_name text NOT NULL,
  instagram_username text NOT NULL UNIQUE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.participants TO anon, authenticated;
GRANT ALL ON public.participants TO service_role;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_all_participants" ON public.participants FOR ALL USING (true) WITH CHECK (true);

CREATE TYPE public.content_kind AS ENUM ('post','reel','story','text','other');

CREATE TABLE public.content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid REFERENCES public.participants(id) ON DELETE CASCADE,
  content_date date NOT NULL DEFAULT current_date,
  kind public.content_kind NOT NULL DEFAULT 'other',
  caption text,
  transcript text,
  source_url text,
  file_path text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_items TO anon, authenticated;
GRANT ALL ON public.content_items TO service_role;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_all_content_items" ON public.content_items FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX content_items_date_idx ON public.content_items (content_date DESC);
CREATE INDEX content_items_participant_idx ON public.content_items (participant_id);

CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER participants_updated_at BEFORE UPDATE ON public.participants
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
