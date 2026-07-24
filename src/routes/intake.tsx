import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast, Toaster } from "sonner";
import { AtlasHeader } from "@/components/AtlasNav";
import { processDailyContent } from "@/lib/process.functions";

export const Route = createFileRoute("/intake")({
  component: IntakePage,
  head: () => ({
    meta: [
      { title: "Material do dia · SOUL AI BRASIL" },
      { name: "description", content: "Envie posts, Reels, Stories e transcrições do dia associados às personas." },
      { property: "og:title", content: "Material do dia · SOUL AI BRASIL" },
      { property: "og:description", content: "Envie material do dia associado às personas do reality." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Kind = "post" | "reel" | "story" | "text" | "other";

type ContentItem = {
  id: string;
  participant_id: string | null;
  content_date: string;
  kind: Kind;
  caption: string | null;
  transcript: string | null;
  source_url: string | null;
  file_path: string | null;
  created_at: string;
};

type Participant = { id: string; persona_name: string; instagram_username: string };

const BUCKET = "reality-media";

function IntakePage() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);

  const { data: participants } = useQuery({
    queryKey: ["participants-lite"],
    queryFn: async (): Promise<Participant[]> => {
      const { data, error } = await supabase
        .from("participants")
        .select("id, persona_name, instagram_username")
        .order("persona_name");
      if (error) throw error;
      return data as Participant[];
    },
  });

  const { data: items } = useQuery({
    queryKey: ["content-items", date],
    queryFn: async (): Promise<(ContentItem & { participant?: Participant })[]> => {
      const { data, error } = await supabase
        .from("content_items")
        .select("*, participant:participants(id, persona_name, instagram_username)")
        .eq("content_date", date)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (ContentItem & { participant?: Participant })[];
    },
  });

  const [form, setForm] = useState({
    participant_id: "",
    kind: "post" as Kind,
    caption: "",
    transcript: "",
    source_url: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [bulk, setBulk] = useState("");

  const processFn = useServerFn(processDailyContent);
  const process = useMutation({
    mutationFn: () => processFn({ data: { script_date: date } }),
    onSuccess: (r) =>
      toast.success(`Processados ${r.processed} (transcritos: ${r.transcribed})`),
    onError: (e: Error) => toast.error(e.message),
  });


  const addItem = useMutation({
    mutationFn: async () => {
      let file_path: string | null = null;
      if (file) {
        const path = `${date}/${form.participant_id || "unassigned"}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file);
        if (error) throw error;
        file_path = path;
      }
      const { error } = await supabase.from("content_items").insert({
        participant_id: form.participant_id || null,
        content_date: date,
        kind: form.kind,
        caption: form.caption.trim() || null,
        transcript: form.transcript.trim() || null,
        source_url: form.source_url.trim() || null,
        file_path,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item adicionado");
      setForm({ participant_id: "", kind: "post", caption: "", transcript: "", source_url: "" });
      setFile(null);
      qc.invalidateQueries({ queryKey: ["content-items", date] });
      qc.invalidateQueries({ queryKey: ["home-counts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkImport = useMutation({
    mutationFn: async () => {
      if (!bulk.trim()) throw new Error("Cole um JSON ou texto.");
      let parsed: unknown;
      try {
        parsed = JSON.parse(bulk);
      } catch {
        // Plain text: single "other" item without participant
        const { error } = await supabase.from("content_items").insert({
          content_date: date,
          kind: "text",
          transcript: bulk.trim(),
        });
        if (error) throw error;
        return 1;
      }
      const list = Array.isArray(parsed)
        ? parsed
        : (parsed as { items?: unknown[] })?.items ?? [];
      if (!Array.isArray(list) || !list.length) throw new Error("JSON sem itens.");

      const byHandle = new Map(
        (participants ?? []).map((p) => [p.instagram_username, p.id] as const),
      );
      const records = list.map((raw) => {
        const r = raw as Record<string, unknown>;
        const handle =
          typeof r.username === "string"
            ? r.username.replace(/^@+/, "").toLowerCase()
            : typeof r.instagram_username === "string"
              ? r.instagram_username.replace(/^@+/, "").toLowerCase()
              : "";
        return {
          participant_id: byHandle.get(handle) ?? null,
          content_date: (r.content_date as string) || date,
          kind: ((r.kind as Kind) ?? "other") as Kind,
          caption: (r.caption as string) ?? null,
          transcript: (r.transcript as string) ?? null,
          source_url: (r.source_url as string) ?? (r.url as string) ?? null,
        };
      });
      const { error } = await supabase.from("content_items").insert(records);
      if (error) throw error;
      return records.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} itens importados`);
      setBulk("");
      qc.invalidateQueries({ queryKey: ["content-items", date] });
      qc.invalidateQueries({ queryKey: ["home-counts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (item: ContentItem) => {
      if (item.file_path) await supabase.storage.from(BUCKET).remove([item.file_path]);
      const { error } = await supabase.from("content_items").delete().eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item removido");
      qc.invalidateQueries({ queryKey: ["content-items", date] });
      qc.invalidateQueries({ queryKey: ["home-counts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function openFile(path: string) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error || !data) {
      toast.error("Não foi possível abrir o arquivo");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-right" />
      <AtlasHeader current="/intake" />


      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Material do dia</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Registre posts, Reels, Stories e transcrições associados às personas.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => process.mutate()}
              disabled={process.isPending}
              className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
            >
              {process.isPending ? "Processando..." : "Processar material do dia"}
            </button>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Data:</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
          </div>

        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Single item form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addItem.mutate();
            }}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="mb-3 text-sm font-semibold">Adicionar um item</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={form.participant_id}
                onChange={(e) => setForm((f) => ({ ...f, participant_id: e.target.value }))}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">— Participante (opcional) —</option>
                {participants?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.persona_name} (@{p.instagram_username})
                  </option>
                ))}
              </select>
              <select
                value={form.kind}
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as Kind }))}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="post">Post</option>
                <option value="reel">Reel</option>
                <option value="story">Story</option>
                <option value="text">Texto</option>
                <option value="other">Outro</option>
              </select>
              <input
                placeholder="URL de origem (opcional)"
                value={form.source_url}
                onChange={(e) => setForm((f) => ({ ...f, source_url: e.target.value }))}
                className="sm:col-span-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <textarea
                placeholder="Legenda"
                rows={2}
                value={form.caption}
                onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
                className="sm:col-span-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <textarea
                placeholder="Transcrição / descrição detalhada"
                rows={3}
                value={form.transcript}
                onChange={(e) => setForm((f) => ({ ...f, transcript: e.target.value }))}
                className="sm:col-span-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <label className="sm:col-span-2 flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">Arquivo:</span>
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="flex-1 text-sm"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={addItem.isPending}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {addItem.isPending ? "Enviando..." : "Adicionar item"}
            </button>
          </form>

          {/* Bulk paste */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-2 text-sm font-semibold">Colar JSON ou texto consolidado</div>
            <p className="mb-3 text-xs text-muted-foreground">
              Aceita array JSON (<code>[{"{ username, kind, caption, transcript, source_url }"}]</code>) ou
              <code> {"{ items: [...] }"}</code>. Texto simples vira um item &ldquo;texto&rdquo; do dia.
            </p>
            <textarea
              rows={10}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder='[{"username":"persona1","kind":"reel","caption":"...","transcript":"..."}]'
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
            />
            <button
              onClick={() => bulkImport.mutate()}
              disabled={bulkImport.isPending}
              className="mt-3 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              {bulkImport.isPending ? "Importando..." : "Importar em lote"}
            </button>
          </div>
        </div>

        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">
            Material de {date} · {items?.length ?? 0} {items?.length === 1 ? "item" : "itens"}
          </h2>
          <div className="rounded-xl border border-border bg-card">
            {!items?.length ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum item para essa data ainda.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((it) => (
                  <li key={it.id} className="flex items-start justify-between gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium uppercase tracking-wider">
                          {it.kind}
                        </span>
                        <span className="font-medium">
                          {it.participant?.persona_name ?? "Sem participante"}
                        </span>
                        {it.participant && (
                          <span className="text-xs text-muted-foreground">
                            @{it.participant.instagram_username}
                          </span>
                        )}
                      </div>
                      {it.caption && (
                        <p className="mt-2 text-sm">{it.caption}</p>
                      )}
                      {it.transcript && (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                          {it.transcript}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {it.source_url && (
                          <a
                            href={it.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                          >
                            Fonte ↗
                          </a>
                        )}
                        {it.file_path && (
                          <button
                            onClick={() => openFile(it.file_path!)}
                            className="hover:underline"
                          >
                            Abrir arquivo ↗
                          </button>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm("Remover este item?")) remove.mutate(it);
                      }}
                      className="text-xs font-medium text-destructive hover:underline"
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
