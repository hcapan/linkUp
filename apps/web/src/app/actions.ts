'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import type { MentorshipRequestInput, ProfileInput } from '@linkup/core';
import { ApiError, PERSONA_COOKIE, api } from '@/lib/api';
import type { MentorshipDetail, PersonProfile, Persona, RequestDetail } from '@/lib/types';

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; issues?: { path: string; message: string }[] };

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath('/', 'layout');
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ApiError) {
      const issues = (err.body as { issues?: { path: string; message: string }[] } | undefined)?.issues;
      return { ok: false, error: err.message, issues };
    }
    console.error(err);
    return { ok: false, error: 'Something went wrong — is the API running on :4100?' };
  }
}

export async function switchPersona(id: string | null) {
  const jar = await cookies();
  if (id) jar.set(PERSONA_COOKIE, id, { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 });
  else jar.delete(PERSONA_COOKIE);
  revalidatePath('/', 'layout');
}

export async function searchPersonas(q: string) {
  return api<{ featured: Persona[]; people: Persona[] }>(`/demo/personas?q=${encodeURIComponent(q)}`, { persona: null });
}

export async function createProfile(input: ProfileInput) {
  const result = await run(() => api<PersonProfile>('/people', { method: 'POST', body: JSON.stringify(input), persona: null }));
  if (result.ok) await switchPersona(result.data.id);
  return result;
}

export async function updateProfile(id: string, input: ProfileInput) {
  return run(() => api<PersonProfile>(`/people/${id}`, { method: 'PUT', body: JSON.stringify(input) }));
}

export async function createRequest(input: MentorshipRequestInput) {
  return run(() => api<RequestDetail>('/requests', { method: 'POST', body: JSON.stringify(input) }));
}

export async function rematchRequest(id: string) {
  return run(() => api<RequestDetail>(`/requests/${id}/rematch`, { method: 'POST' }));
}

export async function selectMentor(requestId: string, mentorId: string, message?: string) {
  return run(() =>
    api<MentorshipDetail>(`/requests/${requestId}/select`, { method: 'POST', body: JSON.stringify({ mentorId, message }) }),
  );
}

export async function mentorshipAction(id: string, action: 'approve' | 'decline' | 'cancel' | 'complete', reason?: string) {
  return run(() =>
    api<MentorshipDetail>(`/mentorships/${id}/${action}`, {
      method: 'POST',
      body: action === 'decline' ? JSON.stringify({ reason }) : undefined,
    }),
  );
}

/** Regenerate the demo dataset (program admin). Persona ids change, so the persona is cleared. */
export async function resetDemoData() {
  const result = await run(() => api<{ people: number }>('/demo/reset', { method: 'POST' }));
  if (result.ok) await switchPersona(null);
  return result;
}
