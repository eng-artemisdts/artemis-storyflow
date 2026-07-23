# StoryFlow

Storyboard com IA inspirado no recurso de storyboard do Google Flow (Veo): do roteiro ao vídeo, cena a cena, com provedores de IA no modelo **BYOK** (bring your own key).

O fluxo é dividido em 4 etapas por projeto:

1. **Roteiro** — cole ou escreva o roteiro do vídeo.
2. **Análise & Assets** — um LLM extrai personagens, cenários e cenas (structured output validado com Zod) e gera imagens de referência via provedor de imagem.
3. **Whiteboard** — canvas infinito (React Flow) com todos os elementos como nós conectados: edite prompts, reorganize, reconecte e regenere assets.
4. **Geração de Vídeo** — selecione cenas no whiteboard e gere clipes image-to-video, acompanhando cada job; timeline com download individual.

## Stack

- Next.js 16 (App Router) + TypeScript estrito
- Server Actions para mutações + Route Handlers para polling/webhooks
- Tailwind CSS v4 + shadcn/ui + lucide-react + sonner
- @xyflow/react (React Flow 12) + @dagrejs/dagre (auto-layout)
- Prisma ORM 7 + SQLite em dev (schema pronto para Postgres)
- Zustand (estado do whiteboard) + Zod (validação em todas as actions)
- Vercel AI SDK (`generateObject`) para análise do roteiro

## Setup

```bash
pnpm install

# 1. Ambiente
cp .env.example .env
# gere a chave de criptografia das credenciais BYOK (obrigatório):
openssl rand -hex 32   # cole no ENCRYPTION_KEY do .env

# 2. Banco
pnpm prisma migrate dev

# 3. Rodar
pnpm dev
```

Acesse http://localhost:3000, crie um projeto e cadastre suas chaves em **Configurações**.

## Onde obter cada chave de API

| Provedor | Uso | Onde obter |
| --- | --- | --- |
| fal.ai | imagem + vídeo (implementado) | https://fal.ai/dashboard/keys |
| Replicate | imagem + vídeo (implementado) | https://replicate.com/account/api-tokens |
| Anthropic | LLM de análise | https://console.anthropic.com/settings/keys |
| OpenAI | LLM de análise + imagem (GPT Image 2) | https://platform.openai.com/api-keys |
| Google AI Studio | LLM de análise + vídeo (Veo 3/3.1 e Omni Flash) | https://aistudio.google.com/apikey |
| xAI | vídeo (Grok Imagine Video) | https://console.x.ai |
| Runway | vídeo (stub) | https://dev.runwayml.com |
| Kling (oficial) | vídeo (stub) | https://app.klingai.com/global/dev |

Para testar o fluxo completo ponta a ponta basta **uma chave fal.ai** (imagem + vídeo) e uma chave de LLM (Gemini, Anthropic ou OpenAI).

As chaves são criptografadas com AES-256-GCM (`src/lib/crypto.ts`) e usadas apenas em Server Actions / Route Handlers — nunca chegam ao cliente. Opcionalmente, defina chaves de fallback do dono do app no `.env`.

## Arquitetura de provedores

Strategy/Adapter pattern com factory central em `src/lib/providers/registry.ts`:

```
src/lib/providers/
  types.ts        # ImageGenProvider, VideoGenProvider, ScriptAnalysisProvider
  registry.ts     # (providerId, apiKey, model) => instância
  models.ts       # catálogo de modelos sugeridos para a UI
  image/          # fal (real), replicate (real), openai (real), gemini (stub)
  video/          # fal (real), replicate (real), runway (stub), kling (stub)
  llm/            # anthropic, openai, gemini (todos reais via AI SDK)
```

Adicionar um provider novo = criar 1 arquivo implementando a interface + registrar no `registry.ts`.

Todos os providers de imagem/vídeo são assíncronos (submit → jobId → poll). A fila de vídeo limita a concorrência a 2 jobs simultâneos por provedor; os demais ficam `queued` e são liberados conforme o polling (`GET /api/jobs/:id`) avança. Assets prontos são baixados para `public/uploads/` (abstração `StorageService` em `src/lib/storage.ts`, pronta para trocar por S3/R2).

## Scripts

```bash
pnpm dev             # dev server
pnpm build           # build de produção
pnpm lint            # eslint
pnpm prisma studio   # inspecionar o banco
```

## App desktop (Electron)

O StoryFlow pode rodar como app nativo e gerar instaladores (`.dmg` / `.exe` / `.AppImage`).

### Desenvolvimento

Em um terminal, suba o Next:

```bash
pnpm dev
```

Em outro, abra a janela Electron apontando para o servidor local:

```bash
pnpm electron:dev
```

Dados (DB, uploads e exports temporários) ficam em `userData` do Electron quando `STORYFLOW_DESKTOP=1`.

### Build de executáveis

```bash
# Gera standalone + empacota para o SO atual
pnpm desktop:build

# Só um alvo
pnpm desktop:build:mac
pnpm desktop:build:win
pnpm desktop:build:linux
```

Artefatos em `dist-desktop/`.

Notas:
- O prepare embute um binário **Node** no bundle (o Next/Prisma/CapCut CLI não usam o runtime do Electron).
- Chaves BYOK continuam nas Configurações; `ENCRYPTION_KEY` é gerada automaticamente em `userData` na primeira abertura.
- Build cross-plataforma (ex.: `.exe` a partir de macOS) exige CI ou máquina do SO alvo.

## Produção (Postgres)

1. Troque `provider = "sqlite"` por `"postgresql"` em `prisma/schema.prisma`.
2. Aponte `DATABASE_URL` para o Postgres e troque o adapter em `src/lib/prisma.ts` por `@prisma/adapter-pg`.
3. Rode `pnpm prisma migrate dev`.

## TODOs conhecidos

- Webhooks de fal.ai/Replicate (`POST /api/webhooks/[provider]`) — stub documentado no arquivo.
- Providers stub: Gemini (imagem), Runway/Kling oficial (vídeo).
- Imagens geradas pela OpenAI ficam apenas em `public/uploads/` (a API retorna base64, sem URL pública). Se o provedor de **vídeo** for fal/Replicate, ele não consegue baixar esses keyframes locais — use Google AI Studio (Veo/Omni, envia a imagem inline) ou xAI (upload via Files API), gere os keyframes com fal.ai/Replicate, ou exponha os uploads publicamente (S3/R2).
- Montagem final do vídeo (concatenação dos clipes) — fora do escopo do scaffold.
