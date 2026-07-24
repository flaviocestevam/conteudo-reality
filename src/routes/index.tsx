import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "ATLAS Captura & Roteiro" },
      {
        name: "description",
        content:
          "Painel de captura, organização e roteiro diário para o reality show das 27 personas de IA.",
      },
      { property: "og:title", content: "ATLAS Captura & Roteiro" },
      {
        property: "og:description",
        content:
          "Painel de captura, organização e roteiro diário para o reality show das 27 personas de IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Home() {
  const { data: counts } = useQuery({
    queryKey: ["home-counts"],
    queryFn: async () => {
      const [p, c] = await Promise.all([
        supabase.from("participants").select("id", { count: "exact", head: true }),
        supabase.from("content_items").select("id", { count: "exact", head: true }),
      ]);
      return { participants: p.count ?? 0, items: c.count ?? 0 };
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-bold tracking-tight">ATLAS</span>
            <span className="text-sm text-muted-foreground">Captura & Roteiro</span>
          </div>
          <nav className="flex gap-1 text-sm">
            <Link
              to="/participants"
              className="rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
            >
              Participantes
            </Link>
            <Link
              to="/intake"
              className="rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
            >
              Intake do dia
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <section className="mb-14">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Fase 1 — Cadastro e Intake
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Painel de operação do reality de 27 personas de IA
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground">
            Cadastre os participantes, receba o material do dia (arquivos, JSON ou texto
            consolidado) e mantenha tudo organizado por data e persona. IA de roteiro e
            integração com Google Drive entram nas próximas fases.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/participants"
            className="group rounded-2xl border border-border bg-card p-6 transition hover:border-foreground/40"
          >
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Perfis cadastrados
            </div>
            <div className="mb-3 text-4xl font-bold tabular-nums">
              {counts?.participants ?? "—"} <span className="text-lg text-muted-foreground">/ 27</span>
            </div>
            <div className="text-sm text-muted-foreground group-hover:text-foreground">
              Gerenciar participantes →
            </div>
          </Link>

          <Link
            to="/intake"
            className="group rounded-2xl border border-border bg-card p-6 transition hover:border-foreground/40"
          >
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Itens do material recebido
            </div>
            <div className="mb-3 text-4xl font-bold tabular-nums">{counts?.items ?? "—"}</div>
            <div className="text-sm text-muted-foreground group-hover:text-foreground">
              Enviar material do dia →
            </div>
          </Link>
        </section>
      </main>
    </div>
  );
}
