import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { ScriptContent } from "./scripts.functions";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
const Input = z.object({ script_date: z.string() });

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function requireDriveKeys() {
  const lovable = process.env.LOVABLE_API_KEY;
  const drive = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lovable) throw new Error("LOVABLE_API_KEY ausente");
  if (!drive)
    throw new Error(
      "Google Drive não conectado. Conecte o conector Google Drive nas configurações antes de sincronizar.",
    );
  return { lovable, drive };
}

async function driveFetch(path: string, init: RequestInit = {}) {
  const { lovable, drive } = requireDriveKeys();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${lovable}`);
  headers.set("X-Connection-Api-Key", drive);
  const res = await fetch(`${GATEWAY}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Drive [${res.status}]: ${body}`);
  }
  return res;
}

async function findOrCreateFolder(name: string, parentId: string | null): Promise<string> {
  const q = [
    `name='${name.replace(/'/g, "\\'")}'`,
    `mimeType='application/vnd.google-apps.folder'`,
    `trashed=false`,
    parentId ? `'${parentId}' in parents` : null,
  ]
    .filter(Boolean)
    .join(" and ");
  const searchRes = await driveFetch(
    `/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`,
  );
  const search = (await searchRes.json()) as { files?: Array<{ id: string }> };
  if (search.files?.[0]?.id) return search.files[0].id;

  const createRes = await driveFetch("/drive/v3/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    }),
  });
  const created = (await createRes.json()) as { id: string };
  return created.id;
}

async function uploadMarkdown(name: string, content: string, parentId: string): Promise<string> {
  // Check if a file with the same name already exists in this folder — overwrite it.
  const q = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`;
  const existRes = await driveFetch(
    `/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`,
  );
  const exist = (await existRes.json()) as { files?: Array<{ id: string }> };

  const boundary = "-------lovable-atlas-" + Math.random().toString(36).slice(2);
  const metadata = exist.files?.[0]?.id
    ? { name }
    : { name, parents: [parentId] };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/markdown; charset=UTF-8\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const path = exist.files?.[0]?.id
    ? `/upload/drive/v3/files/${exist.files[0].id}?uploadType=multipart`
    : `/upload/drive/v3/files?uploadType=multipart`;
  const method = exist.files?.[0]?.id ? "PATCH" : "POST";

  const res = await driveFetch(path, {
    method,
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  const json = (await res.json()) as { id: string };
  return json.id;
}

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function buildRelatorioMd(
  date: string,
  content: ScriptContent,
  materialByPersona: Map<string, Array<{ kind: string; text: string }>>,
): string {
  const lines: string[] = [];
  lines.push(`# Relatório do dia — ${date}`, "");
  lines.push(`## Resumo executivo`, "", content.resumo_executivo || "_(sem resumo)_", "");

  if (content.sinapse_intro) {
    lines.push(`## Dra. Sinapse — abertura`, "", content.sinapse_intro, "");
  }

  lines.push(`## Material por persona`, "");
  for (const [name, arr] of materialByPersona) {
    lines.push(`### ${name}`, "");
    for (const item of arr) {
      lines.push(`- **${item.kind}** — ${item.text || "_(sem texto)_"}`);
    }
    lines.push("");
  }

  lines.push(`## Roteiros por momento`, "");
  content.momentos.forEach((m, i) => {
    lines.push(
      `### ${i + 1}. ${m.titulo}`,
      "",
      `_${m.descricao}_`,
      "",
      `- **Personas:** ${m.personas_envolvidas.join(", ") || "—"}`,
      `- **Ângulos:** ${m.angulos.join(", ")}`,
      `- **Formato:** ${m.formato}`,
      "",
    );
    for (const f of m.falas) {
      lines.push(`**${f.comentarista}:** ${f.texto}`, "");
    }
  });

  if (content.sinapse_outro) {
    lines.push(`## Dra. Sinapse — encerramento`, "", content.sinapse_outro, "");
  }

  return lines.join("\n");
}

export const syncDayToDrive = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    requireDriveKeys();
    const supabase = getSupabase();

    const { data: settings } = await supabase
      .from("settings")
      .select("drive_folder_id, drive_root_name")
      .eq("singleton", true)
      .maybeSingle();
    const rootName = settings?.drive_root_name ?? "SOUL-AI-BRASIL-Capturas";
    const rootParent = (settings?.drive_folder_id as string | null) ?? null;

    // Load script
    const { data: script, error: sErr } = await supabase
      .from("daily_scripts")
      .select("*")
      .eq("script_date", data.script_date)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!script) throw new Error("Gere o roteiro do dia antes de sincronizar com o Drive.");

    // Load items grouped
    const { data: items, error: iErr } = await supabase
      .from("content_items")
      .select(
        "kind, caption, transcript, metadata, participants(persona_name, instagram_username)",
      )
      .eq("content_date", data.script_date);
    if (iErr) throw new Error(iErr.message);

    const materialByPersona = new Map<string, Array<{ kind: string; text: string }>>();
    for (const it of items ?? []) {
      const p = it.participants as { persona_name?: string } | null;
      const name = p?.persona_name ?? "Desconhecido";
      const meta = (it.metadata as Record<string, unknown> | null) ?? null;
      const consolidated = (meta?.consolidated_text as string | undefined) ?? "";
      const text = consolidated || [it.caption, it.transcript].filter(Boolean).join("\n\n");
      const arr = materialByPersona.get(name) ?? [];
      arr.push({ kind: String(it.kind), text });
      materialByPersona.set(name, arr);
    }

    // Ensure folders
    const rootId = await findOrCreateFolder(rootName, rootParent);
    const dayId = await findOrCreateFolder(data.script_date, rootId);

    // Persona subfolders + text files
    let idx = 0;
    for (const [personaName, arr] of materialByPersona) {
      idx++;
      const num = String(idx).padStart(2, "0");
      const folderName = `Persona-${num}-${slugify(personaName)}`;
      const personaFolder = await findOrCreateFolder(folderName, dayId);
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        const filename = `${String(i + 1).padStart(2, "0")}-${item.kind}.md`;
        const md = `# ${personaName} — ${item.kind}\n\n${item.text || "_(sem texto)_"}\n`;
        await uploadMarkdown(filename, md, personaFolder);
      }
    }

    // Relatório geral
    const relatorio = buildRelatorioMd(
      data.script_date,
      script.content as ScriptContent,
      materialByPersona,
    );
    await uploadMarkdown("00-RELATORIO-GERAL.md", relatorio, dayId);

    return {
      ok: true,
      folder_url: `https://drive.google.com/drive/folders/${dayId}`,
      folder_id: dayId,
    };
  });
