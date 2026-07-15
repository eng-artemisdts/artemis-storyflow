"use client";

import { useState, type ComponentType } from "react";
import {
  Ban,
  BookOpen,
  Check,
  CircleHelp,
  Clapperboard,
  Copy,
  Globe2,
  Hash,
  Layers,
  MessageCircle,
  Mic2,
  Quote,
  Ruler,
  Sparkles,
  Target,
  Timer,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import type { ChannelNarrativeConfig } from "@/lib/narrative/channel-config";
import { formatChannelConfigBlock } from "@/lib/narrative/channel-config";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ConfigField = {
  key: string;
  label: string;
  value: string;
  tooltip: string;
  icon: ComponentType<{ className?: string }>;
};

type ConfigGroup = {
  title: string;
  description: string;
  fields: ConfigField[];
};

function buildGroups(config: ChannelNarrativeConfig): ConfigGroup[] {
  return [
    {
      title: "Identidade",
      description: "Sobre o que o canal fala e como a voz se posiciona.",
      fields: [
        {
          key: "NICHE",
          label: "Nicho",
          value: config.niche,
          tooltip:
            "Tema editorial do canal. Define o universo das histórias e o tipo de detalhes usados no roteiro.",
          icon: BookOpen,
        },
        {
          key: "CONCRETE_UNITS",
          label: "Detalhes concretos",
          value: config.concreteUnits,
          tooltip:
            "Unidades e objetos específicos do nicho (datas, números, texturas). Tornam a narração tangível.",
          icon: Ruler,
        },
        {
          key: "BRAND_SIGNOFF",
          label: "Assinatura",
          value: config.brandSignoff,
          tooltip:
            "Frase de encerramento opcional do canal. Use \"none\" para não assinar o roteiro.",
          icon: Quote,
        },
      ],
    },
    {
      title: "Idioma e tratamento",
      description: "Como o espectador é tratado na narração.",
      fields: [
        {
          key: "OUTPUT_LANGUAGE",
          label: "Idioma",
          value: config.outputLanguage,
          tooltip: "Idioma em que o roteiro inteiro é escrito.",
          icon: Globe2,
        },
        {
          key: "ADDRESS_FORM",
          label: "Tratamento",
          value: config.addressForm,
          tooltip:
            "Forma de se dirigir ao espectador (você, tú, you). Mantém o tom informal e consistente.",
          icon: MessageCircle,
        },
        {
          key: "FORBIDDEN_FORMS",
          label: "Formas proibidas",
          value: config.forbiddenForms,
          tooltip:
            "Registro que o roteiro deve evitar — por exemplo português europeu ou tratamento formal.",
          icon: Ban,
        },
      ],
    },
    {
      title: "Extensão do roteiro",
      description: "Calculado a partir da duração média do canal.",
      fields: [
        {
          key: "WORD_MIN",
          label: "Palavras (mín.)",
          value: String(config.wordMin),
          tooltip: "Limite inferior de palavras. Abaixo disso o roteiro é considerado curto demais.",
          icon: Hash,
        },
        {
          key: "WORD_TARGET",
          label: "Palavras (alvo)",
          value: String(config.wordTarget),
          tooltip: "Meta ideal de palavras — bate com a duração média escolhida para os vídeos.",
          icon: Target,
        },
        {
          key: "WORD_MAX",
          label: "Palavras (máx.)",
          value: String(config.wordMax),
          tooltip: "Teto de palavras. Acima disso o roteiro precisa ser cortado.",
          icon: Timer,
        },
        {
          key: "SCENES_MIN",
          label: "Cenas (mín.)",
          value: String(config.scenesMin),
          tooltip: "Número mínimo de cenas/movimentos narrativos no roteiro.",
          icon: Layers,
        },
        {
          key: "SCENES_MAX",
          label: "Cenas (máx.)",
          value: String(config.scenesMax),
          tooltip: "Número máximo de cenas/movimentos narrativos no roteiro.",
          icon: Clapperboard,
        },
        {
          key: "SCENE_WORDS",
          label: "Palavras por cena",
          value: config.sceneWords,
          tooltip: "Faixa sugerida de palavras por cena, para manter ritmo e comprimento estáveis.",
          icon: Type,
        },
      ],
    },
    {
      title: "Assinatura narrativa",
      description: "Ganchos e voz repetidos ao longo dos vídeos.",
      fields: [
        {
          key: "SUSPENSE_PHRASE",
          label: "Frase de suspense",
          value: config.suspensePhrase,
          tooltip:
            "Gancho recorrente do canal (ex.: \"Você ainda não sabe, mas...\"). Semear 3–6 vezes no roteiro.",
          icon: Sparkles,
        },
      ],
    },
  ];
}

function FieldRow({ field }: { field: ConfigField }) {
  const Icon = field.icon;
  return (
    <div className="group flex gap-3 rounded-lg border bg-background/60 px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-background">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors hover:bg-primary/15"
            aria-label={field.tooltip}
          >
            <Icon className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-64 text-left leading-relaxed">
          {field.tooltip}
        </TooltipContent>
      </Tooltip>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="rounded-full text-muted-foreground/70 transition-colors hover:text-foreground"
                aria-label={`Ajuda: ${field.label}`}
              >
                <CircleHelp className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-64 text-left leading-relaxed">
              {field.tooltip}
            </TooltipContent>
          </Tooltip>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
            {field.key}
          </span>
        </div>
        <p className="mt-0.5 break-words text-sm leading-snug text-foreground">{field.value}</p>
      </div>
    </div>
  );
}

export function ChannelConfigDialog({
  config,
  durationMin,
  videoAspectRatio,
}: {
  config: ChannelNarrativeConfig;
  durationMin: number;
  videoAspectRatio: string;
}) {
  const [copied, setCopied] = useState(false);
  const groups = buildGroups(config);
  const rawBlock = formatChannelConfigBlock(config);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(rawBlock);
      setCopied(true);
      toast.success("CHANNEL CONFIG copiado");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            className={cn(
              "mb-10 flex w-full items-center gap-4 rounded-xl border bg-card/60 px-4 py-3.5 text-left",
              "transition-colors hover:border-primary/40 hover:bg-card",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mic2 className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Configuração do roteiro</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {durationMin} min · {videoAspectRatio} · ~{config.wordTarget.toLocaleString("pt-BR")}{" "}
                palavras · {config.scenesMin}–{config.scenesMax} cenas
              </p>
            </div>
            <span className="shrink-0 text-xs font-medium text-primary">Ver detalhes</span>
          </button>
        </DialogTrigger>

        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4 pr-12">
            <DialogTitle className="flex items-center gap-2">
              <Mic2 className="size-5 text-primary" />
              Configuração do roteiro
            </DialogTitle>
            <DialogDescription>
              Valores efetivos usados no master prompt deste canal. Derivados da identidade e
              da duração média — não precisam ser editados manualmente aqui.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[min(28rem,calc(85vh-9rem))]">
            <div className="space-y-6 px-6 py-4 pb-6">
              {groups.map((group) => (
                <section key={group.title} className="space-y-2.5">
                  <div>
                    <h3 className="text-sm font-medium">{group.title}</h3>
                    <p className="text-xs text-muted-foreground">{group.description}</p>
                  </div>
                  <div className="grid gap-2">
                    {group.fields.map((field) => (
                      <FieldRow key={field.key} field={field} />
                    ))}
                  </div>
                </section>
              ))}

              <section className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-medium">Bloco bruto</h3>
                    <p className="text-xs text-muted-foreground">
                      Formato CHANNEL CONFIG injetado no prompt.
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
                <pre className="overflow-hidden rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
                  {rawBlock}
                </pre>
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
