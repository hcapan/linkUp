/** Minimal LinkUP API client for the bot (the bot is just another API client). */
const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4100';
const BOT_KEY = process.env.BOT_API_KEY ?? '';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; as?: string } = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      'x-bot-key': BOT_KEY,
      ...(opts.as ? { 'x-linkup-user': opts.as } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.message ?? `API ${res.status}`, data?.issues);
  }
  return data as T;
}

export interface LinkedPerson {
  id: string;
  fullName: string;
  cecId: string;
  isMentor: boolean;
}

export async function personByEmail(email: string): Promise<LinkedPerson | null> {
  try {
    return await api<LinkedPerson>(`/bot/people/by-email?email=${encodeURIComponent(email)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export interface BotMentorship {
  id: string;
  status: string;
  matchScore: number | null;
  focus: string;
  message: string | null;
  declineReason: string | null;
  headline: string | null;
  rationale: string | null;
  webexRoomId: string | null;
  endsAt: string | null;
  goal: string | null;
  mentee: { id: string; fullName: string; cecId: string; jobTitle: string; webexEmail: string | null };
  mentor: { id: string; fullName: string; cecId: string; jobTitle: string; webexEmail: string | null };
}
