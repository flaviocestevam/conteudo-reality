import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast, Toaster } from "sonner";
import { AtlasHeader } from "@/components/AtlasNav";

export const Route = createFileRoute("/participants")({
  component: ParticipantsPage,
  head: () => ({
    meta: [
      { title: "Perfis · ATLAS Captura & Roteiro" },
      { name: "description", content: "Cadastro dos 27 participantes do reality SOUL AI BRASIL." },
      { property: "og:title", content: "Perfis · ATLAS Captura & Roteiro" },
      { property: "og:description", content: "Cadastro dos 27 participantes do reality de IA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Participant = {
  id: string;
  persona_name: string;
  instagram_username: string;
  notes: string | null;
  created_at: string;
};

function normalizeHandle(v: string) {
  return v.trim().replace(/^@+/, "").toLowerCase();
}

function ParticipantsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["participants"],
    queryFn: async (): Promise<Participant[]> => {
      const { data, error } = await supabase
        .from("participants")
        .select("*")
        .order("persona_name");
      if (error) throw error;
      return data as Participant[];
    },
  });

  const [editing, setEditing] = useState<Participant | null>(null);
  const [form, setForm] = useState({ persona_name: "", instagram_username: "", notes: "" });

  const save = useMutation({
    mutationFn: async (payload: typeof form & { id?: string }) => {
      const record = {
        persona_name: payload.persona_name.trim(),
        instagram_username: normalizeHandle(payload.instagram_username),
        notes: payload.notes.trim() || null,
      };
      if (!record.persona_name || !record.instagram_username) {
        throw new Error("Nome da persona e @ do Instagram são obrigatórios.");
      }
      if (payload.id) {
        const { error } = await supabase.from("participants").update(record).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("participants").insert(record);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Participante atualizado" : "Participante adicionado");
      setEditing(null);
      setForm({ persona_name: "", instagram_username: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["participants"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("participants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["participants"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startEdit(p: Participant) {
    setEditing(p);
    setForm({
      persona_name: p.persona_name,
      instagram_username: p.instagram_username,
      notes: p.notes ?? "",
    });
  }

  function cancelEdit() {
    setEditing(null);
    setForm({ persona_name: "", instagram_username: "", notes: "" });
  }

  async function importJson(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : parsed.participants;
      if (!Array.isArray(list)) throw new Error("JSON inválido. Esperado array ou { participants: [] }.");
      const records = list
        .map((r: Record<string, unknown>) => ({
          persona_name: String(r.persona_name ?? r.name ?? "").trim(),
          instagram_username: normalizeHandle(
            String(r.instagram_username ?? r.username ?? r.handle ?? ""),
          ),
          notes: r.notes ? String(r.notes) : null,
        }))
        .filter((r) => r.persona_name && r.instagram_username);
      if (!records.length) throw new Error("Nenhum registro válido no arquivo.");
      const { error } = await supabase
        .from("participants")
        .upsert(records, { onConflict: "instagram_username" });
      if (error) throw error;
      toast.success(`${records.length} participantes importados`);
      qc.invalidateQueries({ queryKey: ["participants"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar");
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(data ?? [], null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `participantes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-right" />
      <AtlasHeader current="/participants" />


      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Participantes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data?.length ?? 0} de 27 personas cadastradas
            </p>
          </div>
          <div className="flex gap-2">
            <label className="cursor-pointer rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
              Importar JSON
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importJson(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <button
              onClick={exportJson}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent"
            >
              Exportar JSON
            </button>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({ ...form, id: editing?.id });
          }}
          className="mb-8 grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-[1fr_1fr_auto]"
        >
          <div className="sm:col-span-3 text-sm font-semibold">
            {editing ? "Editar participante" : "Novo participante"}
          </div>
          <input
            required
            placeholder="Nome da persona"
            value={form.persona_name}
            onChange={(e) => setForm((f) => ({ ...f, persona_name: e.target.value }))}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="@instagram"
            value={form.instagram_username}
            onChange={(e) => setForm((f) => ({ ...f, instagram_username: e.target.value }))}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {editing ? "Salvar" : "Adicionar"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                Cancelar
              </button>
            )}
          </div>
          <textarea
            placeholder="Notas (opcional): personalidade, arco na história, referências..."
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            className="sm:col-span-3 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </form>

        <div className="rounded-xl border border-border bg-card">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : !data?.length ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum participante ainda. Adicione o primeiro acima ou importe um JSON.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Persona</th>
                  <th className="px-4 py-3">Instagram</th>
                  <th className="px-4 py-3">Notas</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{p.persona_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">@{p.instagram_username}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-md truncate">
                      {p.notes ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => startEdit(p)}
                        className="mr-2 text-xs font-medium hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remover ${p.persona_name}?`)) remove.mutate(p.id);
                        }}
                        className="text-xs font-medium text-destructive hover:underline"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
