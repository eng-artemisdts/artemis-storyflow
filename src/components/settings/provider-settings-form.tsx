"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  IMAGE_PROVIDERS,
  LLM_PROVIDERS,
  TRANSCRIPTION_PROVIDERS,
  VIDEO_PROVIDERS,
} from "@/lib/providers/models";
import type { ProviderOption } from "@/lib/providers/models";
import { useAiSettings } from "@/hooks/use-ai-settings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Selection {
  provider: string;
  model: string;
}

function ProviderModelPicker({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: ProviderOption[];
  value: Selection;
  onChange: (next: Selection) => void;
}) {
  const selected = options.find((o) => o.id === value.provider);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Provedor</Label>
          <Select
            value={value.provider}
            onValueChange={(provider) => {
              const opt = options.find((o) => o.id === provider);
              onChange({ provider, model: opt?.models[0]?.value ?? "" });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  <span className="flex items-center gap-2">
                    {o.label}
                    {!o.implemented && (
                      <Badge variant="outline" className="text-[10px]">
                        stub
                      </Badge>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Modelo</Label>
          <Select
            value={value.model}
            onValueChange={(model) => onChange({ ...value, model })}
            disabled={!selected}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {selected?.models.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProviderSettingsForm() {
  const { hydrated, providers, setProviders } = useAiSettings();
  const [image, setImage] = useState<Selection>({
    provider: "fal",
    model: IMAGE_PROVIDERS[0].models[0].value,
  });
  const [video, setVideo] = useState<Selection>({
    provider: "fal",
    model: VIDEO_PROVIDERS[0].models[0].value,
  });
  const [llm, setLlm] = useState<Selection>({
    provider: "gemini",
    model: "gemini-2.5-flash",
  });
  const [transcription, setTranscription] = useState<Selection>({
    provider: "audioshake",
    model: "alignment",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    setImage({ provider: providers.imageProvider, model: providers.imageModel });
    setVideo({ provider: providers.videoProvider, model: providers.videoModel });
    setLlm({ provider: providers.llmProvider, model: providers.llmModel });
    setTranscription({
      provider: providers.transcriptionProvider,
      model: providers.transcriptionModel,
    });
  }, [hydrated, providers]);

  function handleSave() {
    setSaving(true);
    try {
      setProviders({
        imageProvider: image.provider,
        imageModel: image.model,
        videoProvider: video.provider,
        videoModel: video.model,
        llmProvider: llm.provider,
        llmModel: llm.model,
        transcriptionProvider: transcription.provider,
        transcriptionModel: transcription.model,
      });
      toast.success("Provedores salvos neste navegador");
    } finally {
      setSaving(false);
    }
  }

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ProviderModelPicker
        title="LLM — roteiro e análise"
        options={LLM_PROVIDERS}
        value={llm}
        onChange={setLlm}
      />
      <ProviderModelPicker
        title="Imagem — personagens, cenários e keyframes"
        options={IMAGE_PROVIDERS}
        value={image}
        onChange={setImage}
      />
      <ProviderModelPicker
        title="Vídeo — clipes das cenas"
        options={VIDEO_PROVIDERS}
        value={video}
        onChange={setVideo}
      />
      <ProviderModelPicker
        title="Transcrição — timestamps da narração"
        options={TRANSCRIPTION_PROVIDERS}
        value={transcription}
        onChange={setTranscription}
      />
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Salvar provedores
        </Button>
      </div>
    </div>
  );
}
