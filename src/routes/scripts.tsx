import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Toaster, toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AtlasHeader } from "@/components/AtlasNav";
import { generateDailyScript, type ScriptContent, type Momento } from "@/lib/scripts.functions";
import { processDailyContent } from "@/lib/process.functions";
import { syncDayToDrive } from "@/lib/drive.functions";

export const Route = createFileRoute("/scripts")({
  component: ScriptsPage,
  head: () => ({
    meta: [
      { title: "Roteiros · SOUL AI BRASIL" },
      { name: "description", content: "Roteiro diário por momentos com PROMPT, AGENTE e TOKEN." },
      { property: "og:title", content: "Roteiros · SOUL AI BRASIL" },
      { property: "og:description", content: "Roteiro diário por momentos com os três comentaristas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function ScriptsPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [driveUrl, setDriveUrl] = useState<string | null>(null);

  const genFn = useServerFn(generateDailyScript);
  const processFn = useServerFn(processDailyContent);
  const syncFn = useServerFn(syncDayToDrive);

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

  const process = useMutation({
    mutationFn: () => processFn({ data: { script_date: date } }),
    onSuccess: (r) =>
      toast.success(
        `Processados ${r.processed} itens (transcritos: ${r.transcribed}, já processados: ${r.skipped})`,
      ),
    onError: (e: Error) => toast.error(e.message),
  });

  const gen = useMutation({
    mutationFn: () => genFn({ data: { script_date: date } }),
    onSuccess: () => {
      toast.success("Roteiro gerado");
      qc.invalidateQueries({ queryKey: ["daily-script", date] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sync = useMutation({
    mutationFn: () => syncFn({ data: { script_date: date } }),
    onSuccess: (r) => {
      toast.success("Sincronizado com Google Drive");
      setDriveUrl(r.folder_url);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const content = (script?.content as ScriptContent | undefined) ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-right" />
      <AtlasHeader current="/scripts" />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end gap-3">
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
            onClick={() => process.mutate()}
            disabled={process.isPending}
            className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            {process.isPending ? "Processando..." : "1. Processar material"}
          </button>
          <button
            onClick={() => gen.mutate()}
            disabled={gen.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {gen.isPending ? "Gerando..." : script ? "2. Regenerar roteiro" : "2. Gerar roteiro"}
          </button>
          <button
            onClick={() => sync.mutate()}
            disabled={sync.isPending || !script}
            className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            {sync.isPending ? "Sincronizando..." : "3. Enviar ao Google Drive"}
          </button>
          {driveUrl && (
            <a
              href={driveUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary underline"
            >
              Abrir pasta do dia ↗
            </a>
          )}
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

        {!isLoading && !script && (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Sem roteiro para {date}. Registre o material, processe o material e clique em <b>Gerar roteiro</b>.
          </div>
        )}

        {content && (
          <article className="space-y-6">
            {content.sinapse_intro && (
              <Block label="Dra. Sinapse — abertura" text={content.sinapse_intro} />
            )}
            <Block label="Resumo executivo" text={content.resumo_executivo} />

            <div className="space-y-4">
              {content.momentos.map((m, i) => (
                <MomentoCard key={i} idx={i + 1} m={m} />
              ))}
            </div>

            {content.sinapse_outro && (
              <Block label="Dra. Sinapse — encerramento" text={content.sinapse_outro} />
            )}

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
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function colorFor(who: string) {
  if (who === "PROMPT") return "text-blue-500";
  if (who === "AGENTE") return "text-emerald-500";
  return "text-amber-500";
}

function MomentoCard({ idx, m }: { idx: number; m: Momento }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-semibold">#{idx}</span>
        <h3 className="text-base font-semibold">{m.titulo}</h3>
        <span className="text-xs text-muted-foreground">
          {m.formato === "solo" ? "solo" : "diálogo"} · {m.angulos.join(", ")}
        </span>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">{m.descricao}</p>
      {m.personas_envolvidas.length > 0 && (
        <p className="mb-3 text-xs text-muted-foreground">
          <b>Personas:</b> {m.personas_envolvidas.join(", ")}
        </p>
      )}
      <div className="space-y-2">
        {m.falas.map((f, i) => (
          <div key={i} className="rounded-md border border-border/60 p-3">
            <div className={`mb-1 text-xs font-bold ${colorFor(f.comentarista)}`}>
              {f.comentarista}
            </div>
            <p className="text-sm leading-relaxed">{f.texto}</p>
          </div>
        ))}
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
  if (content.sinapse_intro) lines.push(`DRA. SINAPSE (abertura): ${content.sinapse_intro}`, "");
  lines.push(`RESUMO EXECUTIVO: ${content.resumo_executivo}`, "");
  content.momentos.forEach((m, i) => {
    lines.push(`--- Momento ${i + 1}: ${m.titulo} ---`);
    lines.push(`(${m.formato} · ${m.angulos.join(", ")})`);
    lines.push(m.descricao, "");
    for (const f of m.falas) lines.push(`${f.comentarista}: ${f.texto}`);
    lines.push("");
  });
  if (content.sinapse_outro) lines.push(`DRA. SINAPSE (encerramento): ${content.sinapse_outro}`);
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
