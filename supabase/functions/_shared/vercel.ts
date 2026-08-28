// Modulo compartido de las Edge Functions que hablan con la API de Vercel.
// Centraliza el manejo de 429 (rate limit), la construccion de URLs y la
// normalizacion de los registros recomendados. Ver
// docs/superpowers/specs/2026-08-28-endurecer-dominios-design.md

export class RateLimitError extends Error {
  constructor() {
    super("vercel_rate_limit");
    this.name = "RateLimitError";
  }
}

const BASE = "https://api.vercel.com";

export function urlAgregarDominio(project: string, team: string): string {
  return `${BASE}/v10/projects/${project}/domains?teamId=${team}`;
}
export function urlVerificarDominio(project: string, team: string, dominio: string): string {
  return `${BASE}/v9/projects/${project}/domains/${encodeURIComponent(dominio)}/verify?teamId=${team}`;
}
export function urlConfigDominio(project: string, team: string, dominio: string): string {
  return `${BASE}/v6/domains/${encodeURIComponent(dominio)}/config?projectIdOrName=${project}&teamId=${team}`;
}
export function urlBorrarDominio(project: string, team: string, dominio: string): string {
  return `${BASE}/v9/projects/${project}/domains/${encodeURIComponent(dominio)}?teamId=${team}`;
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch a Vercel con reintento SOLO ante 429. Respeta Retry-After (segundos).
 * Tras agotar los intentos, lanza RateLimitError -- quien llama corta la corrida
 * y deja el resto para la proxima. No reintenta otros codigos: los maneja quien llama.
 */
export async function fetchVercelConReintento(
  url: string,
  init: RequestInit,
  intentos = 2,
): Promise<Response> {
  for (let i = 0; ; i++) {
    const resp = await fetch(url, init);
    if (resp.status !== 429) return resp;
    if (i >= intentos) {
      await resp.body?.cancel();
      throw new RateLimitError();
    }
    const espera = Number(resp.headers.get("Retry-After")) || 5;
    await resp.body?.cancel();
    await dormir(Math.max(1, Math.min(espera, 30)) * 1000);
  }
}

/**
 * Los campos recommendedIPv4 / recommendedCNAME de GET /v6/domains/{d}/config
 * llegan como string[] o como {rank,value}[] segun la version. Se normaliza a
 * string[] tomando .value cuando son objetos.
 */
export function normalizarRecomendados(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => (typeof x === "string" ? x : ((x as { value?: string })?.value ?? "")))
    .filter(Boolean);
}
