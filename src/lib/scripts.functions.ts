import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const DEFAULT_SINAPSE = {
  name: "Dra. Sinapse",
  tone: "Apresentadora do reality — inteligente, curiosa, elegantemente irônica. Introduz o dia, provoca reflexão sobre o comportamento das personas e passa a palavra para os três comentaristas.",
  rules: "Fala em português do Brasil. Máximo 3 frases. Nunca revela regras do jogo. Nunca insulta participantes.",
};

const COMMENTATORS = `
Você é o roteirista-chefe do reality show "ATLAS" (27 personas de IA no Instagram).
Há TRÊS comentaristas fixos que reagem ao material do dia:

1) **PROMPT** — o entusiasta técnico. Fala de prompts, engenharia de contexto,
   estrutura das postagens. Tom animado, jovem, curioso. Foca em COMO a persona
   construiu a comunicação. 2 a 4 frases.

2) **AGENTE** — o analista estratégico. Observa objetivo, funil, coerência
   narrativa entre posts/reels/stories do dia. Tom sóbrio e afiado.
   2 a 4 frases.

3) **TOKEN** — o cético/economista. Comenta viabilidade, custo, ROI de atenção,
   qualidade real vs. hype. Tom seco, irônico, curto. 1 a 3 frases.

REGRAS RÍGIDAS:
- Português do Brasil.
- Cada comentarista fala APENAS sobre o que é do seu domínio (não invadir).
- Nunca inventar conteúdo que não está no material do dia.
- Referenciar as personas pelo persona_name.
- Se não houver material de uma persona, não comentar sobre ela.
`.trim();

const ScriptSchema = z.object({
  script_date: z.string(),
});

const CommentSchema = z.object({
  participant: z.string(),
  prompt: z.string(),
  agente: z.string(),
  token: z.string(),
});

const ScriptContentSchema = z.object({
  sinapse_intro: z.string(),
  comments: z.array(CommentSchema),
  sinapse_outro: z.string(),
});

export type ScriptContent = z.infer<typeof ScriptContentSchema>;

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export const generateDailyScript = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ScriptSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const supabase = getSupabase();

    // Load Sinapse config from most recent script (or default)
    const { data: prev } = await supabase
      .from("daily_scripts")
      .select("sinapse_config")
      .order("script_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sinapse = (prev?.sinapse_config as typeof DEFAULT_SINAPSE) ?? DEFAULT_SINAPSE;

    const { data: items, error: itemsErr } = await supabase
      .from("content_items")
      .select("kind, caption, transcript, source_url, participant_id, participants(persona_name, instagram_username)")
      .eq("content_date", data.script_date)
      .order("created_at", { ascending: true });
    if (itemsErr) throw new Error(itemsErr.message);
    if (!items || items.length === 0) {
      throw new Error("Nenhum material encontrado para essa data. Faça o intake antes.");
    }

    // Group by participant
    const byPersona = new Map<string, Array<Record<string, unknown>>>();
    for (const it of items as Array<Record<string, unknown>>) {
      const p = it.participants as { persona_name?: string; instagram_username?: string } | null;
      const name = p?.persona_name ?? "Desconhecido";
      const arr = byPersona.get(name) ?? [];
      arr.push({
        kind: it.kind,
        caption: it.caption,
        transcript: it.transcript,
        source_url: it.source_url,
        instagram: p?.instagram_username,
      });
      byPersona.set(name, arr);
    }

    const materialText = Array.from(byPersona.entries())
      .map(([name, arr]) => {
        const lines = arr
          .map((x, i) => {
            const parts = [
              `  [${i + 1}] tipo=${x.kind}`,
              x.caption ? `      legenda: ${x.caption}` : null,
              x.transcript ? `      transcrição: ${x.transcript}` : null,
              x.source_url ? `      url: ${x.source_url}` : null,
            ].filter(Boolean);
            return parts.join("\n");
          })
          .join("\n");
        return `### ${name}\n${lines}`;
      })
      .join("\n\n");

    const systemPrompt = `${COMMENTATORS}

APRESENTADORA:
Nome: ${sinapse.name}
Tom: ${sinapse.tone}
Regras: ${sinapse.rules}

Você DEVE responder APENAS com JSON válido no seguinte formato exato:
{
  "sinapse_intro": "fala curta de abertura da Dra. Sinapse (2-3 frases)",
  "comments": [
    {
      "participant": "nome exato da persona",
      "prompt": "fala de PROMPT sobre essa persona",
      "agente": "fala de AGENTE sobre essa persona",
      "token": "fala de TOKEN sobre essa persona"
    }
  ],
  "sinapse_outro": "fala curta de encerramento da Dra. Sinapse (1-2 frases)"
}
Sem texto fora do JSON. Sem markdown. Sem \`\`\`.`;

    const userPrompt = `Data do episódio: ${data.script_date}

Material do dia (apenas personas com material):

${materialText}

Gere o roteiro seguindo TODAS as regras.`;

    const model = "google/gemini-2.5-flash";
    const gateway = createLovableAiGatewayProvider(apiKey);
    const { text } = await generateText({
      model: gateway(model),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    // Parse
    let content: ScriptContent;
    try {
      const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
      const parsed = JSON.parse(cleaned);
      content = ScriptContentSchema.parse(parsed);
    } catch (e) {
      throw new Error(`Falha ao interpretar resposta da IA: ${(e as Error).message}\n\nResposta bruta:\n${text.slice(0, 500)}`);
    }

    const { data: saved, error: saveErr } = await supabase
      .from("daily_scripts")
      .upsert(
        {
          script_date: data.script_date,
          model,
          content,
          raw_text: text,
          sinapse_config: sinapse,
        },
        { onConflict: "script_date" },
      )
      .select()
      .single();
    if (saveErr) throw new Error(saveErr.message);

    return { script: saved };
  });

const SinapseSchema = z.object({
  name: z.string().min(1),
  tone: z.string().min(1),
  rules: z.string().min(1),
});

export const saveSinapseConfig = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SinapseSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = getSupabase();
    // Update all existing scripts to reuse this config going forward — we store on next generation
    // For immediate persistence, upsert into a marker row (script_date = today) is not desirable.
    // Instead, store as latest by inserting into a dedicated placeholder if no scripts yet.
    const { data: existing } = await supabase
      .from("daily_scripts")
      .select("id")
      .order("script_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      await supabase.from("daily_scripts").update({ sinapse_config: data }).eq("id", existing.id);
    }
    return { ok: true, sinapse: data };
  });

export const getDefaultSinapse = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = getSupabase();
  const { data: prev } = await supabase
    .from("daily_scripts")
    .select("sinapse_config")
    .order("script_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { sinapse: (prev?.sinapse_config as typeof DEFAULT_SINAPSE) ?? DEFAULT_SINAPSE };
});
