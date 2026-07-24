import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { AtlasHeader } from "@/components/AtlasNav";
import { getSettings, saveSettings } from "@/lib/settings.functions";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Configurações · ATLAS Captura & Roteiro" },
      { name: "description", content: "Configure Google Drive, Dra. Sinapse e integração do ATLAS." },
      { property: "og:title", content: "Configurações · ATLAS Captura & Roteiro" },
      { property: "og:description", content: "Configure Google Drive, Dra. Sinapse e integração." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function SettingsPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getSettings);
  const saveFn = useServerFn(saveSettings);

  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => getFn() });
  const s = data?.settings as
    | {
        drive_folder_id: string | null;
        drive_root_name: string;
        sinapse_weekday: number;
        sinapse_config: { name: string; tone: string; rules: string };
      }
    | null
    | undefined;

  const [form, setForm] = useState({
    drive_folder_id: "",
    drive_root_name: "ATLAS-Capturas",
    sinapse_weekday: 0,
    sinapse_name: "Dra. Sinapse",
    sinapse_tone: "",
    sinapse_rules: "",
  });

  useEffect(() => {
    if (!s) return;
    setForm({
      drive_folder_id: s.drive_folder_id ?? "",
      drive_root_name: s.drive_root_name ?? "ATLAS-Capturas",
      sinapse_weekday: s.sinapse_weekday ?? 0,
      sinapse_name: s.sinapse_config?.name ?? "Dra. Sinapse",
      sinapse_tone: s.sinapse_config?.tone ?? "",
      sinapse_rules: s.sinapse_config?.rules ?? "",
    });
  }, [s]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          drive_folder_id: form.drive_folder_id.trim() || null,
          drive_root_name: form.drive_root_name.trim() || "ATLAS-Capturas",
          sinapse_weekday: form.sinapse_weekday,
          sinapse_config: {
            name: form.sinapse_name,
            tone: form.sinapse_tone,
            rules: form.sinapse_rules,
          },
        },
      }),
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-right" />
      <AtlasHeader current="/settings" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-1 text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Ajustes globais da plataforma. As mudanças passam a valer imediatamente.
        </p>

        <section className="mb-8 rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Google Drive</h2>
          <label className="mb-3 block text-xs font-medium text-muted-foreground">
            Nome da pasta raiz
            <input
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.drive_root_name}
              onChange={(e) => setForm((f) => ({ ...f, drive_root_name: e.target.value }))}
            />
          </label>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            ID da pasta pai no Google Drive (opcional)
            <input
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              placeholder="1a2b3c... (deixe em branco para criar em Meu Drive)"
              value={form.drive_folder_id}
              onChange={(e) => setForm((f) => ({ ...f, drive_folder_id: e.target.value }))}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Conecte o conector <b>Google Drive</b> no painel para habilitar a sincronização.
            O ID pode ser copiado da URL da pasta no Drive.
          </p>
        </section>

        <section className="mb-8 rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Dra. Sinapse</h2>
          <label className="mb-3 block text-xs font-medium text-muted-foreground">
            Dia da semana em que aparece
            <select
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.sinapse_weekday}
              onChange={(e) => setForm((f) => ({ ...f, sinapse_weekday: Number(e.target.value) }))}
            >
              {WEEKDAYS.map((w, i) => (
                <option key={i} value={i}>
                  {w}
                </option>
              ))}
            </select>
          </label>
          <label className="mb-3 block text-xs font-medium text-muted-foreground">
            Nome
            <input
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.sinapse_name}
              onChange={(e) => setForm((f) => ({ ...f, sinapse_name: e.target.value }))}
            />
          </label>
          <label className="mb-3 block text-xs font-medium text-muted-foreground">
            Tom / personalidade
            <textarea
              rows={3}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.sinapse_tone}
              onChange={(e) => setForm((f) => ({ ...f, sinapse_tone: e.target.value }))}
            />
          </label>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Regras
            <textarea
              rows={3}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.sinapse_rules}
              onChange={(e) => setForm((f) => ({ ...f, sinapse_rules: e.target.value }))}
            />
          </label>
        </section>

        <section className="mb-8 rounded-xl border border-border bg-card p-6">
          <h2 className="mb-2 text-lg font-semibold">Webhook de intake externo</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Envie material capturado externamente para{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">POST /api/public/intake</code> com o
            header <code className="rounded bg-muted px-1.5 py-0.5">x-intake-secret</code> igual ao
            segredo <code>INTAKE_SECRET</code>.
          </p>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
{`{
  "date": "2026-07-24",
  "items": [
    {
      "persona_username": "persona1",
      "kind": "reel",
      "caption": "...",
      "transcript": "...",
      "source_url": "https://..."
    }
  ]
}`}
          </pre>
        </section>

        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {save.isPending ? "Salvando..." : "Salvar configurações"}
        </button>
      </main>
    </div>
  );
}
