"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { isImageSafetyError } from "@/lib/image-gen-errors";
import { ImageSafetyAlertDialog } from "@/components/generation/image-safety-alert-dialog";

/**
 * Toast genérico para falhas de geração, ou modal de alerta quando for
 * IMAGE_SAFETY / bloqueio de conteúdo (inclui a resposta do provedor).
 */
export function useImageGenErrorAlert() {
  const [safetyMessage, setSafetyMessage] = useState<string | null>(null);

  const reportImageGenError = useCallback((error: string | null | undefined) => {
    const message = error?.trim() || "erro desconhecido";
    if (isImageSafetyError(message)) {
      setSafetyMessage(message);
      return;
    }
    toast.error(`Falha na geração: ${message}`);
  }, []);

  const alertDialog = (
    <ImageSafetyAlertDialog
      open={Boolean(safetyMessage)}
      message={safetyMessage}
      onOpenChange={(open) => {
        if (!open) setSafetyMessage(null);
      }}
    />
  );

  return { reportImageGenError, alertDialog, safetyMessage };
}
