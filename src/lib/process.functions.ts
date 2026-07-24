import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const Input = z.object({ script_date: z.string() });
const BUCKET = "reality-media";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function transcribeAudio(blob: Blob, filename: string, apiKey: string): Promise<string> {
  const form = new FormData();
  form.append("model", "openai/gpt-4o-mini-transcribe");
  form.append("file", blob, filename);
  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Transcrição falhou [${res.status}]: ${errBody}`);
  }
  const json = (await res.json()) as { text?: string };
  return json.text ?? "";
}

function isAudioOrVideo(name: string): "audio" | "video" | null {
  const lower = name.toLowerCase();
  if (/\.(mp3|wav|m4a|aac|ogg|flac|webm)$/.test(lower)) return "audio";
  if (/\.(mp4|mov|mkv|webm)$/.test(lower)) return lower.endsWith(".webm") ? "audio" : "video";
  return null;
}

/**
 * Processa o material do dia: transcreve áudios e consolida legenda + transcrição
 * em `metadata.consolidated_text`. Não guarda vídeos pesados — remove o arquivo
 * do bucket após extrair o texto.
 */
export const processDailyContent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
    const supabase = getSupabase();

    const { data: items, error } = await supabase
      .from("content_items")
      .select("id, caption, transcript, file_path, metadata")
      .eq("content_date", data.script_date);
    if (error) throw new Error(error.message);

    let processed = 0;
    let transcribed = 0;
    let skipped = 0;

    for (const it of items ?? []) {
      const meta = (it.metadata as Record<string, unknown> | null) ?? {};
      if (meta.processed_at) {
        skipped++;
        continue;
      }
      let transcript = it.transcript ?? "";

      if (!transcript && it.file_path) {
        const kind = isAudioOrVideo(it.file_path);
        if (kind === "audio") {
          const { data: signed } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(it.file_path, 600);
          if (signed?.signedUrl) {
            try {
              const resp = await fetch(signed.signedUrl);
              if (resp.ok) {
                const blob = await resp.blob();
                transcript = await transcribeAudio(
                  blob,
                  it.file_path.split("/").pop() ?? "audio.wav",
                  apiKey,
                );
                transcribed++;
              }
            } catch (e) {
              console.error("Transcription error", (e as Error).message);
            }
          }
        }
        // Descarta mídia após processar
        await supabase.storage.from(BUCKET).remove([it.file_path]);
      }

      const consolidated = [it.caption, transcript].filter(Boolean).join("\n\n").trim();

      await supabase
        .from("content_items")
        .update({
          transcript: transcript || it.transcript,
          file_path: null,
          metadata: {
            ...meta,
            consolidated_text: consolidated,
            processed_at: new Date().toISOString(),
          },
        })
        .eq("id", it.id);
      processed++;
    }

    return { processed, transcribed, skipped };
  });
