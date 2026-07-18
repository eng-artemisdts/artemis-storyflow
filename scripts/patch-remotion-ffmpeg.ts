/**
 * postinstall: adapta ffmpeg/ffprobe do Remotion em macOS < 15.
 * Seguro rodar várias vezes (idempotente).
 */
import {
  ensureRemotionFfmpegCompatible,
  remotionNeedsSystemFfmpeg,
} from "../src/lib/editor/patch-remotion-ffmpeg";

async function main() {
  if (!remotionNeedsSystemFfmpeg()) {
    console.log("[patch-remotion-ffmpeg] macOS compatível — nada a fazer.");
    return;
  }
  try {
    const result = await ensureRemotionFfmpegCompatible();
    if (result.patched) {
      console.log(
        `[patch-remotion-ffmpeg] wrappers instalados (${result.reason})`
      );
    }
  } catch (err) {
    // Não falha o install inteiro — o export vai re-tentar e mostrar o erro.
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[patch-remotion-ffmpeg] aviso: ${message}`);
  }
}

main();
