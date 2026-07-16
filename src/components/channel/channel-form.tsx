"use client";

import { useMemo, useState, useTransition, type ComponentType } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clapperboard,
  Clock,
  Globe2,
  Languages,
  LayoutGrid,
  Loader2,
  Mic2,
  Sparkles,
  Tag,
  Type,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  createChannel,
  previewChannelMasterPrompt,
  suggestChannelField,
  updateChannel,
} from "@/actions/channel.actions";
import { getAiClientContext } from "@/lib/ai-settings-storage";
import {
  DEFAULT_CHANNEL_DURATION_MIN,
  DEFAULT_LANGUAGE,
  DEFAULT_VIDEO_ASPECT_RATIO,
  LANGUAGE_PRESETS,
} from "@/lib/narrative/channel-config";
import {
  DEFAULT_CHANNEL_TYPE,
  channelTypeLabel,
  type ChannelTypeId,
} from "@/lib/narrative/channel-types";
import {
  DEFAULT_NARRATION_TYPE,
  narrationTypeLabel,
  type NarrationTypeId,
} from "@/lib/narrative/narration-types";
import { deriveScriptLengthFromDuration } from "@/lib/narrative/script-length";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AspectRatioPicker } from "@/components/project/aspect-ratio-picker";
import { ChannelTypePicker } from "@/components/channel/channel-type-picker";
import { DurationMinutesPicker } from "@/components/channel/duration-minutes-picker";
import { NarrationTypePicker } from "@/components/channel/narration-type-picker";
import { Checkbox } from "@/components/ui/checkbox";
import type { VideoAspectRatio } from "@/lib/video-aspect";
import { cn } from "@/lib/utils";

export type ChannelFormValues = {
  name: string;
  niche: string;
  description: string;
  videoAspectRatio: VideoAspectRatio;
  targetDurationMin: number;
  outputLanguage: string;
  channelType: ChannelTypeId;
  channelTypeDescription: string;
  hasReferenceCharacter: boolean;
  referenceCharacterName: string;
  referenceCharacterDescription: string;
  narrationType: NarrationTypeId;
  addressForm: string;
  forbiddenForms: string;
  suspensePhrase: string;
  concreteUnits: string;
  brandSignoff: string;
};

type WizardStep = 0 | 1 | 2 | 3 | 4;

const STEPS = [
  { id: 0 as const, label: "Identidade", icon: Type },
  { id: 1 as const, label: "Formato", icon: LayoutGrid },
  { id: 2 as const, label: "Narração", icon: Mic2 },
  { id: 3 as const, label: "Vídeo", icon: Clapperboard },
  { id: 4 as const, label: "Revisar", icon: Check },
];

function emptyForm(initial?: Partial<ChannelFormValues>): ChannelFormValues {
  const language =
    LANGUAGE_PRESETS.find((p) => p.outputLanguage === initial?.outputLanguage) ??
    DEFAULT_LANGUAGE;

  return {
    name: initial?.name ?? "",
    niche: initial?.niche ?? "",
    description: initial?.description ?? "",
    videoAspectRatio: initial?.videoAspectRatio ?? DEFAULT_VIDEO_ASPECT_RATIO,
    targetDurationMin: initial?.targetDurationMin ?? DEFAULT_CHANNEL_DURATION_MIN,
    outputLanguage: initial?.outputLanguage ?? language.outputLanguage,
    channelType: initial?.channelType ?? DEFAULT_CHANNEL_TYPE,
    channelTypeDescription: initial?.channelTypeDescription ?? "",
    hasReferenceCharacter: initial?.hasReferenceCharacter ?? false,
    referenceCharacterName: initial?.referenceCharacterName ?? "",
    referenceCharacterDescription: initial?.referenceCharacterDescription ?? "",
    narrationType: initial?.narrationType ?? DEFAULT_NARRATION_TYPE,
    addressForm: initial?.addressForm ?? language.addressForm,
    forbiddenForms: initial?.forbiddenForms ?? language.forbiddenForms,
    suspensePhrase: initial?.suspensePhrase ?? "",
    concreteUnits: initial?.concreteUnits ?? "",
    brandSignoff:
      initial?.brandSignoff && initial.brandSignoff !== "none" ? initial.brandSignoff : "",
  };
}

export function ChannelForm({
  mode,
  channelId,
  initial,
}: {
  mode: "create" | "edit";
  channelId?: string;
  initial?: Partial<ChannelFormValues>;
}) {
  const [form, setForm] = useState(() => emptyForm(initial));
  const [step, setStep] = useState<WizardStep>(0);
  const [isPending, startTransition] = useTransition();
  const [generatingField, setGeneratingField] = useState<"niche" | "description" | null>(
    null
  );
  const [masterPromptPreview, setMasterPromptPreview] = useState<string | null>(null);
  const [isPreviewingPrompt, setIsPreviewingPrompt] = useState(false);

  const languageLabel = useMemo(
    () =>
      LANGUAGE_PRESETS.find((p) => p.outputLanguage === form.outputLanguage)?.label ??
      LANGUAGE_PRESETS[0]!.label,
    [form.outputLanguage]
  );

  const lengthPreview = useMemo(
    () => deriveScriptLengthFromDuration(form.targetDurationMin),
    [form.targetDurationMin]
  );

  function applyLanguage(label: string) {
    const preset = LANGUAGE_PRESETS.find((p) => p.label === label);
    if (!preset) return;
    setForm((prev) => ({
      ...prev,
      outputLanguage: preset.outputLanguage,
      addressForm: preset.addressForm,
      forbiddenForms: preset.forbiddenForms,
    }));
  }

  function handleGenerateField(field: "niche" | "description") {
    if (field === "niche" && !form.name.trim() && !form.description.trim()) {
      toast.error("Preencha o nome (ou a descrição) antes de gerar o nicho");
      return;
    }
    if (field === "description" && !form.name.trim() && !form.niche.trim()) {
      toast.error("Preencha o nome ou o nicho antes de gerar a descrição");
      return;
    }

    setGeneratingField(field);
    void (async () => {
      try {
        const result = await suggestChannelField({
          ai: getAiClientContext(),
          field,
          name: form.name,
          niche: form.niche,
          description: form.description,
          outputLanguage: form.outputLanguage,
          channelType: form.channelType,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setForm((prev) => ({ ...prev, [field]: result.data.value }));
        toast.success(field === "niche" ? "Nicho gerado" : "Descrição gerada");
      } finally {
        setGeneratingField(null);
      }
    })();
  }

  function buildPayload() {
    return {
      name: form.name,
      niche: form.niche,
      description: form.description,
      videoAspectRatio: form.videoAspectRatio,
      targetDurationMin: form.targetDurationMin,
      outputLanguage: form.outputLanguage,
      channelType: form.channelType,
      channelTypeDescription: form.channelTypeDescription.trim(),
      hasReferenceCharacter: form.hasReferenceCharacter,
      referenceCharacterName: form.hasReferenceCharacter
        ? form.referenceCharacterName.trim()
        : "",
      referenceCharacterDescription: form.hasReferenceCharacter
        ? form.referenceCharacterDescription.trim()
        : "",
      narrationType: form.narrationType,
      addressForm: form.addressForm,
      forbiddenForms: form.forbiddenForms,
      suspensePhrase: form.suspensePhrase.trim(),
      concreteUnits: form.concreteUnits.trim(),
      brandSignoff: form.brandSignoff.trim() || "none",
    };
  }

  function validateStep(current: WizardStep): boolean {
    if (current === 0) {
      if (!form.name.trim()) {
        toast.error("Dê um nome ao canal");
        return false;
      }
      if (!form.niche.trim()) {
        toast.error("Informe o nicho do canal");
        return false;
      }
      if (!form.description.trim()) {
        toast.error("Escreva uma descrição curta do canal");
        return false;
      }
    }
    if (current === 1) {
      if (form.channelType === "custom" && form.channelTypeDescription.trim().length < 10) {
        toast.error("Descreva o formato personalizado (mín. 10 caracteres)");
        return false;
      }
    }
    if (current === 2) {
      if (form.hasReferenceCharacter && !form.referenceCharacterName.trim()) {
        toast.error("Informe o nome do personagem de referência");
        return false;
      }
    }
    return true;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(4, s + 1) as WizardStep);
  }

  function goBack() {
    setStep((s) => Math.max(0, s - 1) as WizardStep);
  }

  async function handlePreviewMasterPrompt() {
    if (!validateStep(0) || !validateStep(1)) return;
    setIsPreviewingPrompt(true);
    try {
      const result = await previewChannelMasterPrompt({
        ...buildPayload(),
        ai: getAiClientContext(),
      });
      if (result.ok) {
        setMasterPromptPreview(result.data.masterPromptTemplate);
        toast.success("Master prompt gerado");
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsPreviewingPrompt(false);
    }
  }

  function handleSubmit() {
    if (!validateStep(0)) {
      setStep(0);
      return;
    }
    if (!validateStep(1)) {
      setStep(1);
      return;
    }
    if (!validateStep(2)) {
      setStep(2);
      return;
    }

    startTransition(async () => {
      const payload = { ...buildPayload(), ai: getAiClientContext() };

      if (mode === "create") {
        const result = await createChannel(payload);
        if (result && !result.ok) toast.error(result.error);
        return;
      }

      if (!channelId) {
        toast.error("Canal inválido");
        return;
      }
      const result = await updateChannel({ channelId, ...payload });
      if (result.ok) toast.success("Canal atualizado — master prompt regenerado");
      else toast.error(result.error);
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Step indicator */}
      <nav className="mb-8 flex items-center justify-center gap-2" aria-label="Etapas">
        {STEPS.map((s, index) => {
          const Icon = s.icon;
          const active = step === s.id;
          const done = step > s.id;
          return (
            <div key={s.id} className="flex items-center gap-2">
              {index > 0 && (
                <div
                  className={cn(
                    "h-px w-6 sm:w-10",
                    done || active ? "bg-primary/60" : "bg-border"
                  )}
                />
              )}
              <button
                type="button"
                onClick={() => {
                  if (s.id <= step) {
                    setStep(s.id);
                    return;
                  }
                  if (validateStep(step)) setStep(s.id);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active && "border-primary bg-primary/10 text-primary",
                  done && !active && "border-emerald-500/40 text-emerald-400",
                  !active && !done && "border-border text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-[10px]",
                    active && "bg-primary text-primary-foreground",
                    done && !active && "bg-emerald-500/20",
                    !active && !done && "bg-muted"
                  )}
                >
                  {done && !active ? <Check className="size-3" /> : <Icon className="size-3" />}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            </div>
          );
        })}
      </nav>

      <div className="overflow-hidden rounded-2xl border bg-card/60 shadow-sm">
        {/* Step 1 — Identidade */}
        {step === 0 && (
          <div className="flex flex-col gap-6 p-6 sm:p-8">
            <header className="space-y-1">
              <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Type className="size-5" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight">Quem é este canal?</h2>
              <p className="text-sm text-muted-foreground">
                Nome, idioma e o que ele conta. Use a IA nos campos abaixo com base no que já
                preencheu.
              </p>
            </header>

            <div className="flex flex-col gap-5">
              <div className="space-y-2">
                <Label htmlFor="channel-name" className="flex items-center gap-2">
                  <Clapperboard className="size-3.5 text-muted-foreground" />
                  Nome do canal
                </Label>
                <Input
                  id="channel-name"
                  placeholder="Ex.: Disciplina Silenciosa"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  autoFocus={mode === "create"}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Languages className="size-3.5 text-muted-foreground" />
                  Idioma dos roteiros
                </Label>
                <Select value={languageLabel} onValueChange={applyLanguage}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_PRESETS.map((p) => (
                      <SelectItem key={p.label} value={p.label}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Globe2 className="size-3" />
                  Define o idioma e o tratamento (&quot;você&quot;, &quot;tú&quot;, &quot;you&quot;).
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="niche" className="flex items-center gap-2">
                    <Tag className="size-3.5 text-muted-foreground" />
                    Nicho
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs text-primary"
                    onClick={() => handleGenerateField("niche")}
                    disabled={generatingField !== null}
                  >
                    {generatingField === "niche" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5" />
                    )}
                    Gerar
                  </Button>
                </div>
                <Input
                  id="niche"
                  placeholder="Ex.: fitness, disciplina e transformação corporal"
                  value={form.niche}
                  onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  Tema editorial — sobre o que os monólogos falam.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="description" className="flex items-center gap-2">
                    <Type className="size-3.5 text-muted-foreground" />
                    Descrição
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs text-primary"
                    onClick={() => handleGenerateField("description")}
                    disabled={generatingField !== null}
                  >
                    {generatingField === "description" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5" />
                    )}
                    Gerar
                  </Button>
                </div>
                <Textarea
                  id="description"
                  rows={4}
                  placeholder="Ex.: Histórias em segunda pessoa sobre constância, treinos solitários e o preço silencioso de desistir."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Tom, promessa e tipo de história que o canal conta.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Tipo de canal */}
        {step === 1 && (
          <div className="flex flex-col gap-6 p-6 sm:p-8">
            <header className="space-y-1">
              <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <LayoutGrid className="size-5" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight">Qual o formato do canal?</h2>
              <p className="text-sm text-muted-foreground">
                Escolha o tipo de roteiro. Cada formato usa um master prompt otimizado — no final,
                a IA personaliza com base nas informações do canal.
              </p>
            </header>

            <ChannelTypePicker
              value={form.channelType}
              onChange={(channelType) => {
                setMasterPromptPreview(null);
                setForm((f) => ({ ...f, channelType }));
              }}
            />

            <div className="space-y-2">
              <Label htmlFor="channel-type-desc">
                Descreva o formato{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional{form.channelType === "custom" ? ", obrigatório para personalizado" : ""})
                </span>
              </Label>
              <Textarea
                id="channel-type-desc"
                rows={3}
                placeholder={
                  form.channelType === "custom"
                    ? "Ex.: Canal de curiosidades científicas em formato pergunta-resposta, 5 min, tom humorístico…"
                    : "Ex.: Foco em histórias de empresas que quase faliram, tom investigativo…"
                }
                value={form.channelTypeDescription}
                onChange={(e) => {
                  setMasterPromptPreview(null);
                  setForm((f) => ({ ...f, channelTypeDescription: e.target.value }));
                }}
                className="resize-none"
              />
            </div>
          </div>
        )}

        {/* Step 3 — Narração */}
        {step === 2 && (
          <div className="flex flex-col gap-6 p-6 sm:p-8">
            <header className="space-y-1">
              <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Mic2 className="size-5" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight">Como é a narração?</h2>
              <p className="text-sm text-muted-foreground">
                O tipo de narrativa define o ponto de vista do roteiro e altera o master prompt
                gerado para o canal.
              </p>
            </header>

            <NarrationTypePicker
              value={form.narrationType}
              onChange={(narrationType) => {
                setMasterPromptPreview(null);
                setForm((f) => ({ ...f, narrationType }));
              }}
            />

            <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="has-reference-character"
                  checked={form.hasReferenceCharacter}
                  onCheckedChange={(checked) => {
                    setMasterPromptPreview(null);
                    setForm((f) => ({
                      ...f,
                      hasReferenceCharacter: checked === true,
                      ...(checked !== true
                        ? { referenceCharacterName: "", referenceCharacterDescription: "" }
                        : {}),
                    }));
                  }}
                />
                <div className="space-y-1">
                  <Label
                    htmlFor="has-reference-character"
                    className="flex cursor-pointer items-center gap-2 text-sm font-medium"
                  >
                    <UserRound className="size-3.5 text-muted-foreground" />
                    Este canal tem um personagem de referência?
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Se sim, o master prompt instruirá o flow a anexar a imagem de storyboard do
                    personagem na geração visual.
                  </p>
                </div>
              </div>

              {form.hasReferenceCharacter ? (
                <div className="flex flex-col gap-3 border-t border-border/60 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="reference-character-name">Nome do personagem</Label>
                    <Input
                      id="reference-character-name"
                      placeholder="Ex.: Marcus, A narradora, O viajante"
                      value={form.referenceCharacterName}
                      onChange={(e) => {
                        setMasterPromptPreview(null);
                        setForm((f) => ({ ...f, referenceCharacterName: e.target.value }));
                      }}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reference-character-desc">
                      Aparência / papel{" "}
                      <span className="font-normal text-muted-foreground">(opcional)</span>
                    </Label>
                    <Textarea
                      id="reference-character-desc"
                      rows={3}
                      placeholder="Ex.: Homem de 40 anos, casaco escuro, expressão contida — protagonista silencioso das histórias do canal."
                      value={form.referenceCharacterDescription}
                      onChange={(e) => {
                        setMasterPromptPreview(null);
                        setForm((f) => ({
                          ...f,
                          referenceCharacterDescription: e.target.value,
                        }));
                      }}
                      className="resize-none"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Step 4 — Formato vídeo */}
        {step === 3 && (
          <div className="flex flex-col gap-6 p-6 sm:p-8">
            <header className="space-y-1">
              <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Clapperboard className="size-5" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight">Como são os vídeos?</h2>
              <p className="text-sm text-muted-foreground">
                Formato padrão do canal. Novos projetos herdam estes valores — a duração ainda
                pode mudar por vídeo.
              </p>
            </header>

            <div className="flex flex-col gap-6">
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Clapperboard className="size-3.5 text-muted-foreground" />
                  Proporção
                </Label>
                <AspectRatioPicker
                  value={form.videoAspectRatio}
                  onChange={(videoAspectRatio) => setForm((f) => ({ ...f, videoAspectRatio }))}
                />
              </div>

              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Clock className="size-3.5 text-muted-foreground" />
                  Duração média
                </Label>
                <DurationMinutesPicker
                  value={form.targetDurationMin}
                  onChange={(targetDurationMin) =>
                    setForm((f) => ({ ...f, targetDurationMin }))
                  }
                  label=""
                  hint="O tamanho do roteiro (palavras e cenas) é calculado automaticamente."
                  showScriptPreview
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 5 — Revisar */}
        {step === 4 && (
          <div className="flex flex-col gap-6 p-6 sm:p-8">
            <header className="space-y-1">
              <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Check className="size-5" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight">Tudo certo?</h2>
              <p className="text-sm text-muted-foreground">
                Confira o resumo. Ao {mode === "create" ? "criar" : "salvar"}, a IA gera o master
                prompt personalizado para este canal.
              </p>
            </header>

            <dl className="flex flex-col gap-4 divide-y divide-border/60 rounded-xl border bg-muted/20">
              <ReviewRow
                icon={Clapperboard}
                label="Nome"
                value={form.name}
                onEdit={() => setStep(0)}
              />
              <ReviewRow icon={Tag} label="Nicho" value={form.niche} onEdit={() => setStep(0)} />
              <ReviewRow
                icon={Type}
                label="Descrição"
                value={form.description}
                onEdit={() => setStep(0)}
              />
              <ReviewRow
                icon={Languages}
                label="Idioma"
                value={languageLabel}
                onEdit={() => setStep(0)}
              />
              <ReviewRow
                icon={LayoutGrid}
                label="Tipo de canal"
                value={
                  form.channelTypeDescription.trim()
                    ? `${channelTypeLabel(form.channelType)} — ${form.channelTypeDescription.trim()}`
                    : channelTypeLabel(form.channelType)
                }
                onEdit={() => setStep(1)}
              />
              <ReviewRow
                icon={Mic2}
                label="Narração"
                value={narrationTypeLabel(form.narrationType)}
                onEdit={() => setStep(2)}
              />
              <ReviewRow
                icon={UserRound}
                label="Personagem"
                value={
                  form.hasReferenceCharacter && form.referenceCharacterName.trim()
                    ? `${form.referenceCharacterName.trim()}${form.referenceCharacterDescription.trim() ? ` — ${form.referenceCharacterDescription.trim()}` : ""} · storyboard anexado no flow`
                    : "Sem personagem de referência"
                }
                onEdit={() => setStep(2)}
              />
              <ReviewRow
                icon={Clapperboard}
                label="Proporção"
                value={form.videoAspectRatio}
                onEdit={() => setStep(3)}
              />
              <ReviewRow
                icon={Clock}
                label="Duração média"
                value={`${form.targetDurationMin} min · ~${lengthPreview.wordTarget.toLocaleString("pt-BR")} palavras`}
                onEdit={() => setStep(3)}
              />
            </dl>

            <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Master prompt</p>
                  <p className="text-xs text-muted-foreground">
                    Pré-visualize antes de salvar (usa o LLM das Configurações).
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handlePreviewMasterPrompt()}
                  disabled={isPreviewingPrompt || isPending}
                >
                  {isPreviewingPrompt ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  {isPreviewingPrompt ? "Gerando…" : "Pré-visualizar"}
                </Button>
              </div>
              {masterPromptPreview ? (
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border bg-background/60 p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
                  {masterPromptPreview}
                </pre>
              ) : null}
            </div>
          </div>
        )}

        {/* Footer nav */}
        <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-6 py-4 sm:px-8">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={goBack} disabled={isPending}>
              <ArrowLeft className="size-4" />
              Voltar
            </Button>
          ) : (
            <span />
          )}

          {step < 4 ? (
            <Button type="button" onClick={goNext}>
              Continuar
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={isPending} size="lg">
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {isPending
                ? "Gerando master prompt…"
                : mode === "create"
                  ? "Criar canal"
                  : "Salvar alterações"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewRow({
  icon: Icon,
  label,
  value,
  onEdit,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 first:pt-4 last:pb-4">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">{value}</dd>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 text-xs text-primary hover:underline"
      >
        Editar
      </button>
    </div>
  );
}
