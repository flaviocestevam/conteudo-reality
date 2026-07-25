import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AtlasHeader } from "@/components/AtlasNav";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "SOUL AI BRASIL" },
      { name: "description", content: "Painel interno de captura, organização e roteiro diário para o reality SOUL AI BRASIL (27 personas de IA)." },
      { property: "og:title", content: "SOUL AI BRASIL" },
      { property: "og:description", content: "Painel de captura, organização e roteiro diário do reality de 27 personas de IA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function Home() {
  const today = todayISO();
  const { data: counts } = useQuery({
    queryKey: ["home-counts", today],
    queryFn: async () => {
      const [p, c, s, todayItems] = await Promise.all([
        supabase.from("participants").select("id", { count: "exact", head: true }),
        supabase.from("content_items").select("id", { count: "exact", head: true }),
        supabase.from("daily_scripts").select("id", { count: "exact", head: true }),
        supabase
          .from("content_items")
          .select("id", { count: "exact", head: true })
          .eq("content_date", today),
      ]);
      return {
        participants: p.count ?? 0,
        items: c.count ?? 0,
        scripts: s.count ?? 0,
        today: todayItems.count ?? 0,
      };
    },
  });

  const { data: lastScript } = useQuery({
    queryKey: ["last-script"],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_scripts")
        .select("script_date, created_at")
        .order("script_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AtlasHeader current="/" />

      <main className="mx-auto max-w-6xl px-6 py-14">
        {/* Hero */}
        <section className="animate-fade-in">
          <span className="mb-4 block text-[10px] font-semibold uppercase tracking-[0.4em] text-primary">
            Soul AI Brasil
          </span>
          <h1 className="font-serif text-5xl leading-[1.05] text-foreground md:text-6xl">
            Captura &amp; Roteiro do reality
            <br className="hidden md:block" /> de <span className="text-primary">27 personas</span> de IA
          </h1>
          <div className="mt-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              Central interna de captura, organização e roteirização diária. Recebe o material já baixado
              e cuida da transcrição, análise por IA, relatório e sincronização com o Google Drive.
            </p>
            <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
              Instagram: captura externa
            </div>
          </div>
        </section>

        {/* Bento Metrics */}
        <section className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Metric
            to="/participants"
            label="Perfis Ativos"
            value={counts?.participants ?? 0}
            suffix="/ 27"
            highlight
          />
          <Metric
            to="/intake"
            label="Material Hoje"
            value={counts?.today ?? 0}
          />
          <Metric
            to="/scripts"
            label="Roteiros Gerados"
            value={counts?.scripts ?? 0}
            hint={lastScript ? `Último: ${lastScript.script_date}` : undefined}
          />
          <Metric
            to="/settings"
            label="Total de Itens"
            value={counts?.items ?? 0}
          />
        </section>

        {/* Fluxo do Dia */}
        <section className="relative mt-8 overflow-hidden rounded-3xl border border-border bg-card p-10">
          <div className="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-primary opacity-[0.06] blur-[100px]" />
          <div className="relative">
            <div className="mb-10 flex items-baseline justify-between gap-6">
              <h2 className="font-serif text-2xl text-foreground">Fluxo do dia</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
              <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-muted-foreground">
                {today}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
              <Step
                n="01"
                title="Recepção"
                desc={<>Material chega via <Link to="/intake" className="text-primary underline-offset-4 hover:underline">Material do dia</Link> ou pelo webhook <code className="text-foreground">POST /api/public/intake</code>.</>}
                active
              />
              <Step
                n="02"
                title="Processamento"
                desc={<>Em <Link to="/scripts" className="text-primary underline-offset-4 hover:underline">Roteiros</Link>: transcrição, análise visual e geração do roteiro por IA.</>}
              />
              <Step
                n="03"
                title="Sincronização"
                desc={<>Pasta <code className="text-foreground">SOUL-AI-BRASIL-Capturas/AAAA-MM-DD/</code> com <code className="text-foreground">00-RELATORIO-GERAL.md</code> e subpasta por persona.</>}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({
  to,
  label,
  value,
  suffix,
  hint,
  highlight,
}: {
  to: "/participants" | "/intake" | "/scripts" | "/settings";
  label: string;
  value: number | string;
  suffix?: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <Link
      to={to}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[0_20px_60px_-20px_rgba(79,70,229,0.5)]"
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <div className="mt-6 flex items-baseline gap-1.5">
        <span className="font-serif text-4xl leading-none tabular-nums text-foreground">
          {value}
        </span>
        {suffix ? (
          <span className="font-serif text-xl text-primary">{suffix}</span>
        ) : null}
      </div>
      {hint ? (
        <span className="mt-3 text-[10px] text-muted-foreground">{hint}</span>
      ) : null}
      {highlight ? (
        <span className="pointer-events-none absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      ) : null}
    </Link>
  );
}

function Step({
  n,
  title,
  desc,
  active,
}: {
  n: string;
  title: string;
  desc: React.ReactNode;
  active?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div
        className={
          active
            ? "flex h-9 w-9 items-center justify-center rounded-full border border-primary text-xs font-bold text-primary"
            : "flex h-9 w-9 items-center justify-center rounded-full border border-border text-xs font-bold text-muted-foreground"
        }
      >
        {n}
      </div>
      <h4 className="font-serif text-base text-foreground">{title}</h4>
      <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}
