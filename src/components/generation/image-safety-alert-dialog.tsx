"use client";

import { ShieldAlert } from "lucide-react";
import {
  imageSafetyAlertTitle,
  isImageSafetyError,
} from "@/lib/image-gen-errors";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Alerta modal quando o Gemini (ou similar) bloqueia a imagem por SAFETY.
 * Exibe a mensagem/resposta completa do provedor.
 */
export function ImageSafetyAlertDialog({
  open,
  message,
  onOpenChange,
}: {
  open: boolean;
  message: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  if (!message || !isImageSafetyError(message)) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-destructive" />
            {imageSafetyAlertTitle(message)}
          </DialogTitle>
          <DialogDescription>
            O provedor recusou gerar esta imagem. Edite o prompt para remover
            conteúdo sensível (violência gráfica, gore, etc.) e tente de novo.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <ShieldAlert />
          <AlertTitle>Resposta do provedor</AlertTitle>
          <AlertDescription>
            <p className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground/90">
              {message}
            </p>
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
