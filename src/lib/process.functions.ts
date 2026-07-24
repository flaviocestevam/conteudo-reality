import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const Input = z.object({ script_date: z.string() });
const BUCKET = "reality-media";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const VISION_MODEL = "google/gemini-2.5-flash";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function mediaKind(name: string): "audio" | "video" | null {
  const lower = name.toLowerCase();
  if (/\.(mp3|wav|m4a|aac|ogg|flac)$/.test(lower)) return "audio";
  if (/\.(mp4|mov|mkv|webm)$/.test(lower)) return "video";
  return null;
}

function mimeFor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".flac")) return "audio/flac";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".mkv")) return "video/x-matroska";
  if (lower.endsWith(".webm")) return "video/webm";
  return "application/octet-stream";
}

async function transcribeAudio(blob: Blob, filename: string, apiKey: string): Promise<string> {
  const form = new FormData();
  form.append("model", "openai/gpt-4o-mini-transcribe");
  form.append("file", blob, filename);
  const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Transcrição falhou [${res.status}]: ${await res.text().catch(() => "")}`);
  }
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

/**
 * Envia o vídeo (limitado em tamanho) ao Gemini multimodal, que já analisa
 * áudio + imagem no mesmo call. Retorna um bloco estruturado com transcrição
 * e análise visual (ações, expressões, ambiente, interações).
 */
async function analyzeVideo(blob: Blob, filename: string, apiKey: string): Promise<string> {
  // Gemini aceita vídeo direto via inlineData. Limitamos a ~18MB para não estourar.
  const MAX = 18 * 1024 * 1024;
  if (blob.size > MAX) {
    return "";
  }
  const b64 = await blobToBase64(blob);
  const mime = mimeFor(filename);
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Você analisa clipes de reality show. Descreva de forma factual e curta, em português do Brasil, APENAS o que é observável. Não invente.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analise este clipe e responda em duas seções:

TRANSCRIÇÃO:
(a transcrição literal da fala, se houver — caso contrário escreva "sem fala")

ANÁLISE VISUAL:
- Ações principais (o que a pessoa faz)
- Expressões e emoções aparentes
- Ambiente/cenário
- Interações com outras pessoas ou câmera
Máximo 8 bullets curtos. Só fatos observáveis.`,
            },
            { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    console.error("Vídeo análise falhou", res.status, await res.text().catch(() => ""));
    return "";
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return (json.choices?.[0]?.message?.content ?? "").trim();
}

function buildConsolidated(parts: {
  caption?: string | null;
  transcript?: string | null;
  visual?: string | null;
}): string {
  const sections: string[] = [];
  if (parts.caption?.trim()) sections.push(`LEGENDA:\n${parts.caption.trim()}`);
  if (parts.transcript?.trim()) sections.push(`TRANSCRIÇÃO:\n${parts.transcript.trim()}`);
  if (parts.visual?.trim()) sections.push(`ANÁLISE VISUAL:\n${parts.visual.trim()}`);
  return sections.join("\n\n").trim();
}

/**
 * Processa o material do dia:
 * - Se já tem consolidated_text, pula.
 * - Áudio → transcrição (STT).
 * - Vídeo → análise multimodal Gemini (transcrição + visual).
 * - Consolida legenda + transcrição + análise visual e descarta a mídia pesada.
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
    let analyzed = 0;
    let skipped = 0;

    for (const it of items ?? []) {
      const meta = (it.metadata as Record<string, unknown> | null) ?? {};
      const alreadyConsolidated =
        typeof meta.consolidated_text === "string" && (meta.consolidated_text as string).length > 0;

      // Se já tem consolidado E não tem arquivo pendente, pula.
      if (alreadyConsolidated && !it.file_path) {
        skipped++;
        continue;
      }

      let transcript = it.transcript ?? "";
      let visual = "";

      if (it.file_path) {
        const kind = mediaKind(it.file_path);
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(it.file_path, 600);
        const url = signed?.signedUrl;
        const filename = it.file_path.split("/").pop() ?? "media";

        if (url && kind) {
          try {
            const resp = await fetch(url);
            if (resp.ok) {
              const blob = await resp.blob();
              if (kind === "audio") {
                if (!transcript) {
                  transcript = await transcribeAudio(blob, filename, apiKey);
                  if (transcript) transcribed++;
                }
              } else if (kind === "video") {
                const combined = await analyzeVideo(blob, filename, apiKey);
                if (combined) {
                  analyzed++;
                  // Separar seções TRANSCRIÇÃO / ANÁLISE VISUAL se presentes.
                  const tMatch = combined.match(/TRANSCRI[ÇC][ÃA]O:\s*([\s\S]*?)(?:\n\s*AN[ÁA]LISE VISUAL:|$)/i);
                  const vMatch = combined.match(/AN[ÁA]LISE VISUAL:\s*([\s\S]*)$/i);
                  const tPart = tMatch?.[1]?.trim();
                  const vPart = vMatch?.[1]?.trim();
                  if (tPart && tPart.toLowerCase() !== "sem fala" && !transcript) {
                    transcript = tPart;
                  }
                  visual = vPart ?? combined;
                }
              }
            }
          } catch (e) {
            console.error("Processamento de mídia falhou", (e as Error).message);
          }
        }

        // Sempre descarta a mídia pesada após tentativa de análise.
        await supabase.storage.from(BUCKET).remove([it.file_path]);
      }

      const consolidated = buildConsolidated({
        caption: it.caption,
        transcript,
        visual,
      });

      await supabase
        .from("content_items")
        .update({
          transcript: transcript || it.transcript,
          file_path: null,
          metadata: {
            ...meta,
            visual_analysis: visual || (meta.visual_analysis as string | undefined) || null,
            consolidated_text: consolidated,
            processed_at: new Date().toISOString(),
          },
        })
        .eq("id", it.id);
      processed++;
    }

    return { processed, transcribed, analyzed, skipped };
  });
