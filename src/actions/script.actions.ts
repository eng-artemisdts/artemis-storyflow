"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { resolveApiKey, runWithAiContext } from "@/lib/credentials";
import { resolveAiProviders } from "@/lib/channel-ai";
import { createLlmProvider } from "@/lib/providers/registry";
import { seedWhiteboard } from "@/lib/whiteboard-layout";
import { fillMasterPrompt } from "@/lib/narrative/fill-master-prompt";
import { generateNarrativeScriptText } from "@/lib/narrative/generate-narrative-script";
import { toNarrativeConfig } from "@/lib/narrative/channel-config";
import type { ChannelTypeId } from "@/lib/narrative/channel-types";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import type { AiClientContext } from "@/lib/ai-settings";
import {
  analyzeScriptMarkdown,
  type ScriptMarkdownAnalysis,
} from "@/lib/narrative/parse-script-markdown";
import { extractScriptMarkdown } from "@/lib/narrative/extract-script-markdown";
import {
  AnalyzeScriptSchema,
  GenerateNarrativeScriptSchema,
  ImportScriptMarkdownSchema,
  SaveScriptSchema,
} from "@/lib/schemas/actions";

export async function saveScript(input: {
  projectId: string;
  script: string;
}): Promise<ActionResult> {
  const parsed = SaveScriptSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  try {
    await prisma.project.update({
      where: { id: parsed.data.projectId },
      data: { script: parsed.data.script },
    });
    revalidatePath(`/projects/${parsed.data.projectId}`, "layout");
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}

/**
 * Importa roteiro .md, analisa estrutura (frontmatter, cenas, palavras) e persiste.
 */
export async function importScriptMarkdown(input: {
  projectId: string;
  script: string;
}): Promise<ActionResult<{ analysis: ScriptMarkdownAnalysis }>> {
  const parsed = ImportScriptMarkdownSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const script = extractScriptMarkdown(parsed.data.script);
  const analysis = analyzeScriptMarkdown(script);
  if (!analysis.valid) {
    return fail(
      analysis.warnings[0] ??
        "Roteiro inválido — o corpo precisa ter pelo menos 50 palavras."
    );
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: parsed.data.projectId },
      select: { videoTopic: true },
    });
    if (!project) return fail("Projeto não encontrado");

    const topicFromFile = analysis.topic?.trim();
    await prisma.project.update({
      where: { id: parsed.data.projectId },
      data: {
        script,
        ...(topicFromFile && !project.videoTopic?.trim()
          ? { videoTopic: topicFromFile }
          : {}),
      },
    });

    revalidatePath(`/projects/${parsed.data.projectId}`, "layout");
    return ok({ analysis });
  } catch (err) {
    return fail(err);
  }
}

/**
 * Preenche o master-prompt-narrativo com a config do canal + tópico,
 * chama o LLM e persiste o roteiro gerado no projeto.
 */
export async function generateNarrativeScript(input: {
  projectId: string;
  videoTopic: string;
  ai?: AiClientContext;
}): Promise<ActionResult<{ script: string; narrativePrompt: string }>> {
  const parsed = GenerateNarrativeScriptSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");
  const { projectId, videoTopic, ai } = parsed.data;

  try {
    return await runWithAiContext(ai, async () => {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { channel: true },
      });
      if (!project) return fail("Projeto não encontrado");
      if (project.videoKind !== "static") {
        return fail("A geração via master prompt está disponível apenas para vídeos static.");
      }
      if (!project.channel) {
        return fail(
          "Este projeto não está vinculado a um canal. Crie o projeto dentro de um canal."
        );
      }
      const providers = resolveAiProviders(project);
      if (!providers.llmProvider || !providers.llmModel) {
        return fail("Configure o provedor de LLM em Configurações.");
      }

      const apiKey = await resolveApiKey(projectId, providers.llmProvider);
      const durationMin = project.targetDurationMin ?? project.channel.targetDurationMin;
      const narrativeConfig = toNarrativeConfig(project.channel, durationMin);
      const filledPrompt = fillMasterPrompt(narrativeConfig, videoTopic, {
        channelType: project.channel.channelType as ChannelTypeId,
        masterPromptTemplate: project.channel.masterPromptTemplate,
      });
      const script = await generateNarrativeScriptText({
        providerId: providers.llmProvider,
        apiKey,
        model: providers.llmModel,
        filledMasterPrompt: filledPrompt,
      });

      if (!script) return fail("O LLM retornou um roteiro vazio. Tente novamente.");

      await prisma.project.update({
        where: { id: projectId },
        data: { script, videoTopic, narrativePrompt: filledPrompt },
      });

      revalidatePath(`/projects/${projectId}`, "layout");
      return ok({ script, narrativePrompt: filledPrompt });
    });
  } catch (err) {
    return fail(err);
  }
}

/**
 * Analisa o roteiro com o LLM (structured output), persiste personagens/
 * cenários/cenas e inicializa o whiteboard com layout automático.
 * Substitui análise anterior, se existir.
 */
export async function analyzeScript(input: {
  projectId: string;
  ai?: AiClientContext;
}): Promise<ActionResult> {
  const parsed = AnalyzeScriptSchema.safeParse(input);
  if (!parsed.success) return fail("Projeto inválido");
  const { projectId, ai } = parsed.data;

  try {
    return await runWithAiContext(ai, async () => {
      const project = await prisma.project.findUniqueOrThrow({
        where: { id: projectId },
        include: { channel: true },
      });
      if (!project.script?.trim()) return fail("Salve um roteiro antes de analisar.");
      const providers = resolveAiProviders(project);
      if (!providers.llmProvider || !providers.llmModel) {
        return fail("Configure o provedor de LLM em Configurações.");
      }

      const apiKey = await resolveApiKey(projectId, providers.llmProvider);
      const llm = createLlmProvider(providers.llmProvider, apiKey, providers.llmModel);
      const analysis = await llm.analyzeScript(project.script);

    // Limpa análise anterior e persiste a nova em transação.
    const { characters, scenarios, scenes } = await prisma.$transaction(async (tx) => {
      await tx.character.deleteMany({ where: { projectId } });
      await tx.scenario.deleteMany({ where: { projectId } });
      await tx.scene.deleteMany({ where: { projectId } });

      const characters = await Promise.all(
        analysis.characters.map((c) =>
          tx.character.create({
            data: {
              projectId,
              name: c.name,
              description: c.description,
              visualPrompt: c.visualPrompt,
            },
          })
        )
      );
      const scenarios = await Promise.all(
        analysis.scenarios.map((s) =>
          tx.scenario.create({
            data: {
              projectId,
              name: s.name,
              description: s.description,
              visualPrompt: s.visualPrompt,
            },
          })
        )
      );

      const characterByName = new Map(characters.map((c) => [c.name.toLowerCase(), c.id]));
      const scenarioByName = new Map(scenarios.map((s) => [s.name.toLowerCase(), s.id]));

      const scenes = await Promise.all(
        analysis.scenes.map((s) =>
          tx.scene.create({
            data: {
              projectId,
              order: s.order,
              title: s.title,
              summary: s.summary,
              videoPrompt: s.videoPrompt,
              dialogue: s.dialogue,
              durationSec: s.durationSec,
              characterIds: JSON.stringify(
                s.characterNames
                  .map((n) => characterByName.get(n.toLowerCase()))
                  .filter((id): id is string => Boolean(id))
              ),
              scenarioId: s.scenarioName
                ? (scenarioByName.get(s.scenarioName.toLowerCase()) ?? null)
                : null,
            },
          })
        )
      );

      return { characters, scenarios, scenes };
    });

    // Seed do whiteboard com layout automático.
    const { nodes, edges } = seedWhiteboard({
      characters,
      scenarios,
      scenes: scenes.map((s) => ({
        ...s,
        characterIds: JSON.parse(s.characterIds) as string[],
      })),
    });
    await prisma.whiteboard.upsert({
      where: { projectId },
      create: { projectId, nodes: JSON.stringify(nodes), edges: JSON.stringify(edges) },
      update: { nodes: JSON.stringify(nodes), edges: JSON.stringify(edges) },
    });

    revalidatePath(`/projects/${projectId}`, "layout");
      return ok(undefined);
    });
  } catch (err) {
    return fail(err);
  }
}
