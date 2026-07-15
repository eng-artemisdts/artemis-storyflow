/** Resultado padronizado das Server Actions (nunca vaza stack trace ao cliente). */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = undefined>(error: unknown): ActionResult<T> {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: message };
}
