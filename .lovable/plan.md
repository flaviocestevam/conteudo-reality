# ATLAS Captura & Roteiro — Reconstrução

O projeto atual (SOUL AI BRASIL) já tem base sólida: cadastro de personas, intake, geração de roteiro com Gemini e tabelas `participants`, `content_items`, `daily_scripts`. Vou renomear para ATLAS e completar o que falta, sem quebrar o que já funciona.

## O que já existe e será mantido/melhorado
- Tabelas `participants`, `content_items`, `daily_scripts` + bucket `reality-media`
- Rotas `/`, `/participants`, `/intake`, `/scripts`
- Geração de roteiro via Lovable AI Gateway (Gemini)
- Import/export JSON de personas

## O que será refeito

### Fase A — Fundação e regras dos comentaristas
1. Renomear UI para **ATLAS Captura & Roteiro** (títulos, heads, dashboard). Manter menção interna a "SOUL AI BRASIL" como nome do reality.
2. Reescrever o prompt de roteiro em `src/lib/scripts.functions.ts` com as **regras rígidas novas**:
   - **PROMPT**: frio/analítico/cético, curto, ranking/padrão/estratégia, insinua a entidade misteriosa (só ele).
   - **AGENTE**: empática/emocional, fala mais longa, humanidade/vulnerabilidade.
   - **TOKEN**: sem filtro, engraçado, costuma fechar; frase mais direta.
   - Estrutura do roteiro passa a ser **por MOMENTO**, não por persona. Cada momento tem: `titulo`, `personas_envolvidas`, `angulos` (dado/emoção/comédia), `formato` (solo|dialogo), `falas[]` com `{comentarista, texto}`.
   - Dra. Sinapse aparece **1x por semana** (dia configurável em settings). Nos demais dias, sem Sinapse.
   - Proibido inventar fatos fora do material.
3. Adicionar tabela `settings` (singleton) com: `sinapse_weekday` (0–6), `drive_folder_id`, `drive_root_name` (default `ATLAS-Capturas`), `sinapse_config` (nome/tom/regras). Migrar `sinapse_config` de `daily_scripts` para settings.

### Fase B — Processamento inteligente (não guardar vídeo)
Novo server fn `processDailyContent({script_date})` que, para cada `content_item` do dia:
1. Se tem `transcript` OU `caption` textual → mantém.
2. Se tem `file_path` de vídeo/áudio no bucket:
   - Baixa via signed URL.
   - Áudio: `openai/gpt-4o-mini-transcribe` no gateway → salva em `transcript`.
   - Vídeo: extrai 3–6 frames com `ffmpeg` **não disponível no worker** → alternativa: enviar o vídeo inteiro (data URL) para `google/gemini-2.5-flash` que aceita vídeo nativamente e pedir "descreva 3–6 momentos visuais + transcreva fala". Salva resultado em `metadata.visual_analysis` e `transcript`.
   - Após processar, **remove o arquivo do bucket** e limpa `file_path`. Fica só texto.
3. Consolida em `metadata.consolidated_text` = legenda + transcrição + análise visual.
4. Marca `metadata.processed_at`.

Botão "Processar material do dia" em `/intake` e em `/scripts`.

### Fase C — Google Drive
1. Conectar via `standard_connectors--connect` (`google_drive`) — HITL card.
2. Settings expõe `drive_folder_id` (pasta raiz onde criar `ATLAS-Capturas/`).
3. Server fn `syncDayToDrive({script_date})`:
   - Cria `ATLAS-Capturas/AAAA-MM-DD/` se não existir.
   - Para cada persona com material: cria `Persona-NN-Nome/` e sobe `.md` por content_item (texto consolidado).
   - Sobe `00-RELATORIO-GERAL.md` na raiz do dia com: resumo executivo (IA) + lista por persona + roteiros por momento.
4. Retorna URL da pasta do dia.

### Fase D — Dashboard reorganizado
Tabs (mantendo rotas atuais, ajustando conteúdo):
- **Status** (`/`): cards (personas cadastradas X/27, dias processados, último roteiro), tabela de status por persona no dia atual.
- **Perfis** (`/participants`): já existe.
- **Material do Dia** (`/intake` renomeado): intake + visualização do que foi processado + link para relatório/pasta Drive.
- **Roteiros** (`/scripts`): mantida, nova estrutura por momentos + botão "Abrir pasta do dia".
- **Configurações** (nova `/settings`): drive_folder_id, sinapse_weekday, sinapse_config, tema.

### Fase E — Webhook + cron
1. Rota pública `POST /api/public/intake` para a ferramenta externa mandar material (assinada por `INTAKE_SECRET`).
   - Body: `{ date, items: [{persona_username, kind, caption?, transcript?, source_url?}] }`.
2. Cron (pg_cron) diário 23:30 chamando `POST /api/public/hooks/process-day` que roda `processDailyContent` + `generateDailyScript` + `syncDayToDrive` para "hoje".

## Ordem de execução nesta sessão
1. Migration: `settings` singleton, mover `sinapse_config`.
2. Rebrand ATLAS + reescrever prompt de roteiro (nova estrutura de momentos + regras novas).
3. Página `/settings`.
4. `processDailyContent` (áudio via gpt-4o-mini-transcribe, vídeo via gemini-2.5-flash multimodal) + botão na UI.
5. Conectar Google Drive + `syncDayToDrive` + botão.
6. Webhook `/api/public/intake` + cron.
7. Atualizar `/scripts` para renderizar nova estrutura de momentos.

## Detalhes técnicos

- Análise de vídeo: gateway Gemini aceita `image_url` com data URL base64; para vídeo passamos `{type:"file", file:{...}}` conforme `ai-multimodal-input`. Como Worker não tem ffmpeg, delegamos ao Gemini a extração conceitual dos "momentos visuais".
- Transcrição: `POST https://ai.gateway.lovable.dev/v1/audio/transcriptions` multipart, `openai/gpt-4o-mini-transcribe`, non-stream para pipeline batch.
- Drive: gateway `https://connector-gateway.lovable.dev/google_drive/drive/v3/...`. Criação de pastas via `files` com `mimeType: application/vnd.google-apps.folder`. Upload markdown via `upload/drive/v3/files?uploadType=multipart`.
- Segurança: RLS permanece aberto (uso interno, sem auth). Autenticação simples fica como próxima fase se solicitada.

## Fora de escopo desta entrega
- Autenticação de usuários (mantém painel aberto).
- Análise real frame-a-frame com ffmpeg (usamos capacidade multimodal nativa do Gemini).
- App nativo/mobile.

Confirma essa direção? Vou executar as fases A→E na sequência.
