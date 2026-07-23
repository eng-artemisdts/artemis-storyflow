import "server-only";
import { resolveGoogleFlowEmail } from "@/lib/credentials";
import { toGoogleFlowAspectRatio } from "@/lib/providers/google-flow/aspect-ratio";
import { throwGoogleFlowError } from "@/lib/providers/google-flow/errors";
import type {
  GoogleFlowErrorBody,
  GoogleFlowImagesResponse,
} from "@/lib/providers/google-flow/types";
import type { AspectRatio } from "@/lib/providers/types";

export const GOOGLE_FLOW_BASE = "https://api.useapi.net/v1/google-flow";

async function parseJsonBody(res: Response): Promise<GoogleFlowErrorBody> {
  try {
    return (await res.json()) as GoogleFlowErrorBody;
  } catch {
    return {};
  }
}

export async function googleFlowFetch<T>(
  token: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${GOOGLE_FLOW_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const data = await parseJsonBody(res);
  if (!res.ok) {
    await throwGoogleFlowError(res, data);
  }
  return data as T;
}

export type GenerateGoogleFlowImageInput = {
  token: string;
  prompt: string;
  model: string;
  aspectRatio?: AspectRatio;
  email?: string | null;
  seed?: number;
};

/**
 * Gera imagem via POST /images (síncrono, ~10–20 s).
 * @see https://useapi.net/docs/api-google-flow-v1/post-google-flow-images
 */
export async function generateGoogleFlowImage(
  input: GenerateGoogleFlowImageInput
): Promise<GoogleFlowImagesResponse> {
  const email = input.email ?? resolveGoogleFlowEmail();
  const body: Record<string, unknown> = {
    prompt: input.prompt,
    model: input.model || "nano-banana-2-lite",
    aspectRatio: toGoogleFlowAspectRatio(input.aspectRatio),
    count: 1,
  };
  if (email) body.email = email;
  if (input.seed != null && input.seed >= 0) body.seed = input.seed;

  return googleFlowFetch<GoogleFlowImagesResponse>(input.token, "/images", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Health check leve — lista contas conectadas. */
export async function listGoogleFlowAccounts(token: string): Promise<unknown> {
  return googleFlowFetch(token, "/accounts", { method: "GET" });
}
