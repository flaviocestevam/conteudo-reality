import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const DEFAULT_SINAPSE = {
  name: "Dra. Sinapse",
  tone:
    "Apresentadora reflexiva do reality — inteligente, curiosa, elegantemente irônica. Aparece apenas 1x por semana para olhar padrões da semana.",
  rules:
    "Português do Brasil. Máximo 4 frases. Nunca revela regras do jogo. Nunca insulta participantes. Nunca aparece nos dias normais.",
};

const COMMENTATORS = `
Você é o roteirista-chefe do reality show "SOUL AI BRASIL" (27 personas de IA no Instagram).
A plataforma se chama "ATLAS Captura & Roteiro".

Existem TRÊS comentaristas fixos:

1) **PROMPT — a mente.**
   Frio, analítico, cético. Fala curta e cortante (1–2 frases).
   Foca em ranking, padrão, estratégia, dado. Questiona manipulação.
   Existe uma **entidade misteriosa** na narrativa: APENAS PROMPT pode insinuar
   sobre ela, sempre de forma especulativa. Nunca confirma nem nega a natureza dela.

2) **AGENTE — o coração.**
   Empática, emocional, calorosa. Fala mais longa (2–4 frases).
   Vê humanidade, vulnerabilidade, conexão. Traz o lado emocional do momento.

3) **TOKEN — a voz sem filtro.**
   Sincera, engraçada, sem filtro social. Diz o que o público está pensando.
   Costuma FECHAR o momento com a frase mais direta e cômica (1–2 frases).

REGRAS DE ATIVAÇÃO POR MOMENTO:
- Cada momento tem um ou mais ÂNGULOS: "dado" | "emoção" | "comédia".
- Momento com 1 ângulo dominante → fala INDIVIDUAL do comentarista daquele ângulo.
  · dado → PROMPT
  · emoção → AGENTE
  · comédia/hipocrisia/constrangimento → TOKEN
- Momento com 2 ou 3 ângulos → DIÁLOGO entre 2 ou 3 comentaristas (na ordem PROMPT → AGENTE → TOKEN, mas TOKEN quase sempre fecha).

REGRAS RÍGIDAS ABSOLUTAS:
- Português do Brasil.
- NUNCA invente fatos, nomes, números, falas ou detalhes que não estejam no material real do dia.
- Referencie personas pelo persona_name exato.
- Cada comentarista fala APENAS dentro do seu domínio (não invadir).
- Se não houver material suficiente, gere menos momentos — não invente.
- A Dra. Sinapse aparece apenas em dias específicos (informado abaixo). Nos demais dias, sinapse_intro e sinapse_outro devem ser strings vazias "".
`.trim();

const FalaSchema = z.object({
  comentarista: z.enum(["PROMPT", "AGENTE", "TOKEN"]),
  texto: z.string(),
});

const MomentoSchema = z.object({
  titulo: z.string(),
  descricao: z.string(),
  personas_envolvidas: z.array(z.string()),
  angulos: z.array(z.enum(["dado", "emoção", "comédia"])),
  formato: z.enum(["solo", "dialogo"]),
  falas: z.array(FalaSchema),
});

const ScriptContentSchema = z.object({
  sinapse_intro: z.string(),
  resumo_executivo: z.string(),
  momentos: z.array(MomentoSchema),
  sinapse_outro: z.string(),
});

export type ScriptContent = z.infer<typeof ScriptContentSchema>;
export type Momento = z.infer<typeof MomentoSchema>;

const ScriptInput = z.object({ script_date: z.string() });

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function loadSettings() {
  const supabase = getSupabase();
  const { data } = await supabase.from("settings").select("*").eq("singleton", true).maybeSingle();
  return {
    sinapse_weekday: (data?.sinapse_weekday as number | undefined) ?? 0,
    sinapse_config:
      (data?.sinapse_config as typeof DEFAULT_SINAPSE | null) ?? DEFAULT_SINAPSE,
    drive_folder_id: (data?.drive_folder_id as string | null) ?? null,
    drive_root_name: (data?.drive_root_name as string | null) ?? "ATLAS-Capturas",
  };
}

export const generateDailyScript = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ScriptInput.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const supabase = getSupabase();
    const settings = await loadSettings();
    const sinapse = settings.sinapse_config;

    const dateObj = new Date(`${data.script_date}T12:00:00Z`);
    const weekday = dateObj.getUTCDay(); // 0=Dom..6=Sáb
    const sinapseDay = weekday === settings.sinapse_weekday;

    const { data: items, error: itemsErr } = await supabase
      .from("content_items")
      .select(
        "kind, caption, transcript, source_url, metadata, participant_id, participants(persona_name, instagram_username)",
      )
      .eq("content_date", data.script_date)
      .order("created_at", { ascending: true });
    if (itemsErr) throw new Error(itemsErr.message);
    if (!items || items.length === 0) {
      throw new Error("Nenhum material encontrado para essa data. Faça o intake antes.");
    }

    const byPersona = new Map<string, Array<Record<string, unknown>>>();
    for (const it of items as Array<Record<string, unknown>>) {
      const p = it.participants as { persona_name?: string; instagram_username?: string } | null;
      const name = p?.persona_name ?? "Desconhecido";
      const meta = (it.metadata as Record<string, unknown> | null) ?? null;
      const consolidated = meta?.consolidated_text as string | undefined;
      const arr = byPersona.get(name) ?? [];
      arr.push({
        kind: it.kind,
        caption: it.caption,
        transcript: it.transcript,
        consolidated,
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
              x.consolidated ? `      análise consolidada: ${x.consolidated}` : null,
              x.source_url ? `      url: ${x.source_url}` : null,
            ].filter(Boolean);
            return parts.join("\n");
          })
          .join("\n");
        return `### ${name}\n${lines}`;
      })
      .join("\n\n");

    const sinapseBlock = sinapseDay
      ? `HOJE É O DIA DA DRA. SINAPSE.
Nome: ${sinapse.name}
Tom: ${sinapse.tone}
Regras: ${sinapse.rules}
Ela faz uma abertura reflexiva (sinapse_intro) e um encerramento reflexivo (sinapse_outro), olhando padrões da semana.`
      : `HOJE NÃO É DIA DA DRA. SINAPSE. sinapse_intro e sinapse_outro DEVEM ser strings vazias "".`;

    const systemPrompt = `${COMMENTATORS}

${sinapseBlock}

Formato de resposta: APENAS JSON válido, sem markdown, sem \`\`\`:
{
  "sinapse_intro": "string (vazia se não for dia dela)",
  "resumo_executivo": "resumo curto do dia em 3-5 frases, factual, só com o que apareceu no material",
  "momentos": [
    {
      "titulo": "título curto do momento",
      "descricao": "1-2 frases descrevendo o que aconteceu (só fatos do material)",
      "personas_envolvidas": ["Nome da Persona", ...],
      "angulos": ["dado" | "emoção" | "comédia"],
      "formato": "solo" | "dialogo",
      "falas": [
        { "comentarista": "PROMPT" | "AGENTE" | "TOKEN", "texto": "..." }
      ]
    }
  ],
  "sinapse_outro": "string (vazia se não for dia dela)"
}

Gere entre 3 e 8 momentos, priorizando os mais relevantes. Se o dia tiver pouco material, gere menos.`;

    const userPrompt = `Data do episódio: ${data.script_date}
Dia da semana: ${["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][weekday]}
Dia da Dra. Sinapse: ${sinapseDay ? "SIM" : "NÃO"}

Material do dia (apenas personas com material):

${materialText}

Gere o roteiro seguindo TODAS as regras. Nunca invente.`;

    const model = "google/gemini-2.5-flash";
    const gateway = createLovableAiGatewayProvider(apiKey);
    const { text } = await generateText({
      model: gateway(model),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    let content: ScriptContent;
    try {
      const cleaned = text
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "");
      content = ScriptContentSchema.parse(JSON.parse(cleaned));
    } catch (e) {
      throw new Error(
        `Falha ao interpretar resposta da IA: ${(e as Error).message}\n\nResposta bruta:\n${text.slice(0, 800)}`,
      );
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
