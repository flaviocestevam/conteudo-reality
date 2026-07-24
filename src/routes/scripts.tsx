import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  generateDailyScript,
  saveSinapseConfig,
  getDefaultSinapse,
  type ScriptContent,
} from "@/lib/scripts.functions";

export const Route = createFileRoute("/scripts")({
  component: ScriptsPage,
  head: () => ({
    meta: [
      { title: "Roteiro diário — ATLAS" },
      {
        name: "description",
        content:
          "Geração de roteiro diário com comentários de PROMPT, AGENTE e TOKEN a partir do material capturado.",
      },
      { property: "og:title", content: "Roteiro diário — ATLAS" },
      {
        property: "og:description",
        content:
          "Geração de roteiro diário com comentários de PROMPT, AGENTE e TOKEN a partir do material capturado.",
      },
    ],
  }),
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function ScriptsPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [showSinapse, setShowSinapse] = useState(false);

  const genFn = useServerFn(generateDailyScript);
  const saveSinapseFn = useServerFn(saveSinapseConfig);
  const getSinapseFn = useServerFn(getDefaultSinapse);

  const { data: script, isLoading } = useQuery({
    queryKey: ["daily-script", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_scripts")
        .select("*")
        .eq("script_date", date)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: sinapseData } = useQuery({
    queryKey: ["sinapse-default"],
    queryFn: () => getSinapseFn(),
  });
  const sinapse = sinapseData?.sinapse;

  const gen = useMutation({
    mutationFn: async () => genFn({ data: { script_date: date } }),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["daily-script", date] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const content = (script?.content as ScriptContent | undefined) ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-baseline gap-3">
            <Link to="/" className="text-lg font-bold tracking-tight">
              ATLAS
            </Link>
            <span className="text-sm text-muted-foreground">Roteiro diário</span>
          </div>
          <nav className="flex gap-1 text-sm">
            <Link to="/participants" className="rounded-md px-3 py-1.5 hover:bg-accent">
              Participantes
            </Link>
            <Link to="/intake" className="rounded-md px-3 py-1.5 hover:bg-accent">
              Intake
            </Link>
            <Link to="/scripts" className="rounded-md bg-accent px-3 py-1.5">
              Roteiro
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <section className="mb-6 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Data do episódio
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => gen.mutate()}
            disabled={gen.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {gen.isPending ? "Gerando com IA..." : script ? "Regerar roteiro" : "Gerar roteiro"}
          </button>
          <button
            onClick={() => setShowSinapse((v) => !v)}
            className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
          >
            {showSinapse ? "Fechar Dra. Sinapse" : "Config. Dra. Sinapse"}
          </button>
        </section>

        {showSinapse && sinapse && (
          <SinapseEditor
            initial={sinapse}
            onSave={async (v) => {
              await saveSinapseFn({ data: v });
              qc.invalidateQueries({ queryKey: ["sinapse-default"] });
              setShowSinapse(false);
            }}
          />
        )}

        {error && (
          <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

        {!isLoading && !script && (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhum roteiro para {date}. Clique em <b>Gerar roteiro</b> para criar a partir do material do intake.
          </div>
        )}

        {content && (
          <article className="space-y-6">
            <Block label="Dra. Sinapse — abertura" text={content.sinapse_intro} />
            <div className="space-y-4">
              {content.comments.map((c, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-5">
                  <h3 className="mb-3 text-base font-semibold">{c.participant}</h3>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Speaker name="PROMPT" text={c.prompt} color="text-blue-500" />
                    <Speaker name="AGENTE" text={c.agente} color="text-emerald-500" />
                    <Speaker name="TOKEN" text={c.token} color="text-amber-500" />
                  </div>
                </div>
              ))}
            </div>
            <Block label="Dra. Sinapse — encerramento" text={content.sinapse_outro} />
            <div className="flex gap-3">
              <button
                onClick={() => downloadJSON(script!.script_date, content)}
                className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
              >
                Baixar JSON
              </button>
              <button
                onClick={() => downloadTXT(script!.script_date, content)}
                className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
              >
                Baixar TXT
              </button>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}

function Block({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <p className="text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function Speaker({ name, text, color }: { name: string; text: string; color: string }) {
  return (
    <div>
      <div className={`mb-1 text-xs font-bold ${color}`}>{name}</div>
      <p className="text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function SinapseEditor({
  initial,
  onSave,
}: {
  initial: { name: string; tone: string; rules: string };
  onSave: (v: { name: string; tone: string; rules: string }) => Promise<void>;
}) {
  const [v, setV] = useState(initial);
  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-5">
      <h3 className="mb-3 text-base font-semibold">Dra. Sinapse — apresentadora</h3>
      <div className="grid gap-3">
        <label className="text-xs font-medium text-muted-foreground">
          Nome
          <input
            value={v.name}
            onChange={(e) => setV({ ...v, name: e.target.value })}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Tom / personalidade
          <textarea
            rows={3}
            value={v.tone}
            onChange={(e) => setV({ ...v, tone: e.target.value })}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Regras
          <textarea
            rows={3}
            value={v.rules}
            onChange={(e) => setV({ ...v, rules: e.target.value })}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div className="mt-3">
        <button
          onClick={() => onSave(v)}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}

function downloadJSON(date: string, content: ScriptContent) {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
  triggerDownload(blob, `roteiro-${date}.json`);
}

function downloadTXT(date: string, content: ScriptContent) {
  const lines: string[] = [];
  lines.push(`ROTEIRO — ${date}`, "");
  lines.push(`DRA. SINAPSE (abertura): ${content.sinapse_intro}`, "");
  for (const c of content.comments) {
    lines.push(`### ${c.participant}`);
    lines.push(`PROMPT: ${c.prompt}`);
    lines.push(`AGENTE: ${c.agente}`);
    lines.push(`TOKEN:  ${c.token}`);
    lines.push("");
  }
  lines.push(`DRA. SINAPSE (encerramento): ${content.sinapse_outro}`);
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  triggerDownload(blob, `roteiro-${date}.txt`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
