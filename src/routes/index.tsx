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

      <main className="mx-auto max-w-6xl px-6 py-12">
        <section className="mb-10">
          <p className="mb-2 text-sm font-medium uppercase tracking-widest text-muted-foreground">
            SOUL AI BRASIL
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Captura & Roteiro do reality de 27 personas de IA
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground">
            Recebe o material capturado externamente, organiza no Google Drive, analisa com IA
            e gera o relatório diário + roteiros de PROMPT, AGENTE e TOKEN.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            to="/participants"
            label="Perfis"
            value={`${counts?.participants ?? "—"} / 27`}
            hint="Gerenciar personas"
          />
          <Card
            to="/intake"
            label="Material hoje"
            value={String(counts?.today ?? "—")}
            hint="Ver material do dia"
          />
          <Card
            to="/scripts"
            label="Roteiros gerados"
            value={String(counts?.scripts ?? "—")}
            hint={lastScript ? `Último: ${lastScript.script_date}` : "Nenhum ainda"}
          />
          <Card
            to="/settings"
            label="Total de itens"
            value={String(counts?.items ?? "—")}
            hint="Configurações →"
          />
        </section>

        <section className="mt-12 rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-2 text-lg font-semibold">Fluxo do dia</h2>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li>1. Receber material via <Link to="/intake" className="text-primary underline">Material do dia</Link> ou pelo webhook <code>POST /api/public/intake</code>.</li>
            <li>2. Em <Link to="/scripts" className="text-primary underline">Roteiros</Link>: processar material (transcrição), gerar roteiro por IA e sincronizar com o Google Drive.</li>
            <li>3. A pasta <code>SOUL-AI-BRASIL-Capturas/AAAA-MM-DD/</code> conterá <code>00-RELATORIO-GERAL.md</code> e uma subpasta por persona.</li>
          </ol>
        </section>
      </main>
    </div>
  );
}

function Card({
  to,
  label,
  value,
  hint,
}: {
  to: "/participants" | "/intake" | "/scripts" | "/settings";
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-border bg-card p-5 transition hover:border-foreground/40"
    >
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mb-2 text-3xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground group-hover:text-foreground">{hint} →</div>
    </Link>
  );
}
