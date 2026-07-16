/** Detecta bloqueios de segurança em mensagens de erro de geração de imagem. */
export function isImageSafetyError(message: string | null | undefined): boolean {
  if (!message?.trim()) return false;
  return /IMAGE_SAFETY|IMAGE_PROHIBITED|IMAGE_RECITATION|Prompt bloqueado|Bloqueio de segurança|finishReason.*SAFETY|\(SAFETY\)/i.test(
    message
  );
}

export function imageSafetyAlertTitle(message: string): string {
  if (/IMAGE_PROHIBITED/i.test(message)) return "Conteúdo proibido na imagem";
  if (/Prompt bloqueado/i.test(message)) return "Prompt bloqueado pelo Gemini";
  return "Imagem bloqueada por segurança (IMAGE_SAFETY)";
}
