import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { cookies } from 'next/headers';

export const PERSONA_COOKIE = 'linkup_user';
const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4100';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
  }
}

export async function currentPersonaId(): Promise<string | null> {
  return (await cookies()).get(PERSONA_COOKIE)?.value ?? null;
}

/**
 * On Cloudflare the API has no public URL and is reached through the `API`
 * service binding (see wrangler.jsonc); everywhere else through API_URL.
 */
function apiFetch(path: string, init: RequestInit): Promise<Response> {
  let binding: { fetch: typeof fetch } | undefined;
  try {
    binding = (getCloudflareContext().env as { API?: { fetch: typeof fetch } }).API;
  } catch {
    // Not running on Cloudflare (next dev / next start).
  }
  if (binding) {
    const { cache: _cache, ...rest } = init;
    return binding.fetch(`https://linkup-api${path}`, rest);
  }
  return fetch(`${API_URL}${path}`, init);
}

/** Server-side call to the LinkUP API as the current demo persona. */
export async function api<T>(path: string, init: RequestInit & { persona?: string | null } = {}): Promise<T> {
  const persona = init.persona === undefined ? await currentPersonaId() : init.persona;
  const res = await apiFetch(path, {
    ...init,
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      ...(persona ? { 'x-linkup-user': persona } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => '');
    }
    const message =
      typeof body === 'object' && body && 'message' in body
        ? String((body as { message: unknown }).message)
        : `API ${res.status}`;
    throw new ApiError(res.status, message, body);
  }
  return (await res.json()) as T;
}

/** Like `api` but returns null on 401/403/404 so pages can render a friendly state. */
export async function apiOrNull<T>(path: string): Promise<T | null> {
  try {
    return await api<T>(path);
  } catch (err) {
    if (err instanceof ApiError && [401, 403, 404].includes(err.status)) return null;
    throw err;
  }
}

/** The current persona's profile, or null when none is chosen or the cookie is stale (e.g. after a reseed). */
export async function getMe(): Promise<import('./types').Me | null> {
  if (!(await currentPersonaId())) return null;
  return apiOrNull<import('./types').Me>('/me');
}
