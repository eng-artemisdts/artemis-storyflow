"use client";

import { useState } from "react";
import { ExternalLink, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CREDENTIAL_PROVIDERS } from "@/lib/providers/models";
import { useAiSettings } from "@/hooks/use-ai-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CredentialsForm() {
  const { hydrated, last4, setApiKey, removeApiKey } = useAiSettings();

  if (!hydrated) {
    return (
      <div className="space-y-3">
        {CREDENTIAL_PROVIDERS.map((p) => (
          <Skeleton key={p.id} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {CREDENTIAL_PROVIDERS.map((provider) => (
        <CredentialRow
          key={provider.id}
          provider={provider}
          last4={last4(provider.id)}
          onSave={(apiKey) => {
            setApiKey(provider.id, apiKey);
            toast.success(`Chave de ${provider.label} salva neste navegador`);
          }}
          onDelete={() => {
            removeApiKey(provider.id);
            toast.success(`Chave de ${provider.label} removida`);
          }}
        />
      ))}
    </div>
  );
}

function CredentialRow({
  provider,
  last4,
  onSave,
  onDelete,
}: {
  provider: { id: string; label: string; keyUrl: string };
  last4: string | null;
  onSave: (apiKey: string) => void;
  onDelete: () => void;
}) {
  const [apiKey, setApiKey] = useState("");

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 py-4">
        <div className="flex w-44 items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{provider.label}</span>
        </div>

        {last4 ? (
          <Badge variant="secondary" className="font-mono">
            ••••{last4}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            não configurada
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Input
            type={provider.id === "google-flow-email" ? "email" : "password"}
            placeholder={
              provider.id === "google-flow-email"
                ? last4
                  ? "Substituir email..."
                  : "conta@gmail.com"
                : last4
                  ? "Substituir chave..."
                  : "Colar chave de API..."
            }
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-56"
            autoComplete="off"
          />
          <Button
            size="sm"
            onClick={() => {
              onSave(apiKey);
              setApiKey("");
            }}
            disabled={
              provider.id === "google-flow-email"
                ? !apiKey.includes("@")
                : apiKey.trim().length < 8
            }
          >
            Salvar
          </Button>
          {last4 && (
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button size="sm" variant="ghost" asChild>
            <a href={provider.keyUrl} target="_blank" rel="noreferrer" title="Obter chave">
              <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
