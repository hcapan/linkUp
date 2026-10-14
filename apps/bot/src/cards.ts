/**
 * Adaptive Cards (schema 1.3, the version Webex renders). The mentee card
 * mirrors the web form so both channels produce the same request payload.
 */
import {
  ARCHITECTURES,
  COACHING_FORMATS,
  COMPETITORS,
  DEAL_SIZES,
  FINANCIAL_SKILLS,
  LICENSING_MODELS,
  PORTFOLIO_TARGET,
  SUBCATEGORIES,
  type MatchBreakdown,
} from '@linkup/core';
import type { BotMentorship } from './api.js';

const WEB = process.env.WEB_BASE_URL ?? 'http://localhost:5050';

type Card = Record<string, unknown>;
const card = (body: unknown[], actions: unknown[] = []): Card => ({
  $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
  type: 'AdaptiveCard',
  version: '1.3',
  body,
  actions,
});
const header = (title: string, subtitle?: string) => ({
  type: 'Container',
  style: 'emphasis',
  bleed: true,
  items: [
    { type: 'TextBlock', text: `◆ ${title}`, weight: 'Bolder', size: 'Medium', wrap: true },
    ...(subtitle ? [{ type: 'TextBlock', text: subtitle, isSubtle: true, wrap: true, spacing: 'None' }] : []),
  ],
});
const label = (text: string) => ({ type: 'TextBlock', text, weight: 'Bolder', size: 'Small', spacing: 'Medium', wrap: true });
const choices = (items: { title: string; value: string }[]) => items;

export function menteeQueryCard(): Card {
  return card(
    [
      header('LinkUP · Mentee Growth Query', 'Takes 60 seconds. Every mentor with an open slot is scored on the 100-point engine.'),
      label('Target architecture'),
      {
        type: 'Input.ChoiceSet',
        id: 'primaryArch',
        value: 'AI',
        choices: choices([
          ...ARCHITECTURES.map((a) => ({ title: `${a.label} (${a.short})`, value: a.code })),
          { title: 'Portfolio breadth (multi-architecture)', value: PORTFOLIO_TARGET },
        ]),
      },
      label('Target subcategories (pick 1–3)'),
      {
        type: 'Input.ChoiceSet',
        id: 'targetSubcategories',
        isMultiSelect: true,
        style: 'compact',
        placeholder: 'e.g. AI-1 · AI Fabrics / HyperFabric',
        choices: choices(SUBCATEGORIES.map((s) => ({ title: `${s.code} · ${s.short}`, value: s.code }))),
      },
      label('Commercial skills to grow (optional)'),
      {
        type: 'Input.ChoiceSet',
        id: 'commercialSkills',
        isMultiSelect: true,
        style: 'compact',
        choices: choices([...LICENSING_MODELS, ...FINANCIAL_SKILLS].map((c) => ({ title: c.short, value: c.code }))),
      },
      label('Deal tier to master'),
      {
        type: 'Input.ChoiceSet',
        id: 'dealSize',
        value: '',
        choices: choices([{ title: 'No preference', value: '' }, ...DEAL_SIZES.map((d) => ({ title: `${d.label} · ${d.detail}`, value: d.code }))]),
      },
      label('Active competitor battle (optional)'),
      {
        type: 'Input.ChoiceSet',
        id: 'competitors',
        isMultiSelect: true,
        style: 'compact',
        choices: choices(COMPETITORS.map((c) => ({ title: c.short, value: c.code }))),
      },
      label('Preferred coaching format'),
      {
        type: 'Input.ChoiceSet',
        id: 'formats',
        isMultiSelect: true,
        style: 'expanded',
        value: 'FMT_LIVE_SHADOWING',
        choices: choices(COACHING_FORMATS.map((f) => ({ title: f.label, value: f.code }))),
      },
      label('Growth goal (used for semantic match)'),
      {
        type: 'Input.Text',
        id: 'goal',
        isMultiline: true,
        placeholder: 'e.g. Master Nexus HyperFabric and RoCEv2 GPU networking, plus EA 3.0 deal defense',
      },
    ],
    [{ type: 'Action.Submit', title: '⚙️ Run 100-point match', data: { action: 'request' } }],
  );
}

export interface MatchForCard {
  rank: number;
  score: number;
  strong: boolean;
  breakdown: MatchBreakdown;
  mentor: { id: string; fullName: string; jobTitle: string } | null;
}

export function matchesCard(requestId: string, matches: MatchForCard[], evaluated: number): Card {
  const body: unknown[] = [header('Your top mentor matches', `Scored ${evaluated} mentors with open slots.`)];
  for (const m of matches) {
    if (!m.mentor) continue;
    const cats = m.breakdown.categories.map((c) => `${c.label.split(' ')[0]} ${Math.round(c.points)}/${c.max}`).join(' · ');
    body.push({
      type: 'Container',
      separator: true,
      spacing: 'Medium',
      items: [
        {
          type: 'ColumnSet',
          columns: [
            {
              type: 'Column',
              width: 'stretch',
              items: [
                { type: 'TextBlock', text: `${m.rank === 1 ? '★ ' : ''}${m.mentor.fullName}`, weight: 'Bolder', wrap: true },
                { type: 'TextBlock', text: m.mentor.jobTitle, isSubtle: true, spacing: 'None', wrap: true },
              ],
            },
            {
              type: 'Column',
              width: 'auto',
              items: [
                { type: 'TextBlock', text: `${m.score}%`, weight: 'Bolder', size: 'Large', color: m.strong ? 'Good' : 'Warning', horizontalAlignment: 'Right' },
                { type: 'TextBlock', text: m.strong ? 'Strong' : 'Partial', isSubtle: true, spacing: 'None', horizontalAlignment: 'Right' },
              ],
            },
          ],
        },
        { type: 'TextBlock', text: m.breakdown.headline, wrap: true, size: 'Small' },
        { type: 'TextBlock', text: cats, wrap: true, isSubtle: true, size: 'Small', spacing: 'Small' },
        {
          type: 'ActionSet',
          actions: [
            {
              type: 'Action.Submit',
              title: `Request ${m.mentor.fullName.split(' ')[0]}`,
              data: { action: 'select', requestId, mentorId: m.mentor.id },
            },
          ],
        },
      ],
    });
  }
  return card(body, [{ type: 'Action.OpenUrl', title: 'Open full rationale in LinkUP', url: `${WEB}/requests/${requestId}` }]);
}

export function approvalCard(m: BotMentorship): Card {
  return card(
    [
      header('New mentorship request', `${m.mentee.fullName} would like you as their mentor.`),
      {
        type: 'FactSet',
        facts: [
          { title: 'Mentee', value: `${m.mentee.fullName} · ${m.mentee.jobTitle}` },
          { title: 'Match', value: `${m.matchScore ?? '—'}%` },
          { title: 'Focus', value: m.focus || '—' },
        ],
      },
      ...(m.goal ? [{ type: 'TextBlock', text: `**Goal:** ${m.goal}`, wrap: true }] : []),
      ...(m.message ? [{ type: 'TextBlock', text: `“${m.message}”`, wrap: true, isSubtle: true }] : []),
      ...(m.headline ? [{ type: 'TextBlock', text: m.headline, wrap: true, size: 'Small' }] : []),
      { type: 'Input.Text', id: 'reason', placeholder: 'Optional note if you decline', isMultiline: true },
    ],
    [
      { type: 'Action.Submit', title: '✓ Approve', style: 'positive', data: { action: 'approve', mentorshipId: m.id } },
      { type: 'Action.Submit', title: 'Decline', style: 'destructive', data: { action: 'decline', mentorshipId: m.id } },
      { type: 'Action.OpenUrl', title: 'View in LinkUP', url: `${WEB}/mentorships/${m.id}` },
    ],
  );
}

export function introCard(m: BotMentorship): Card {
  return card(
    [
      header('Welcome to your LinkUP mentorship 🎉', `${m.mentee.fullName} ↔ ${m.mentor.fullName}`),
      {
        type: 'FactSet',
        facts: [
          { title: 'Focus', value: m.focus || '—' },
          { title: 'Match', value: `${m.matchScore ?? '—'}%` },
          { title: 'Cadence', value: 'Bi-weekly 45-min sync' },
          { title: 'Ends', value: m.endsAt ? new Date(m.endsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
        ],
      },
      ...(m.goal ? [{ type: 'TextBlock', text: `**Growth goal:** ${m.goal}`, wrap: true }] : []),
      ...(m.rationale ? [{ type: 'TextBlock', text: `**Why you were matched:** ${m.rationale}`, wrap: true, size: 'Small' }] : []),
      {
        type: 'TextBlock',
        text: 'Suggested first session: agree on goals for the 6 months, pick a live deal to shadow, and book the recurring sync.',
        wrap: true,
        isSubtle: true,
      },
    ],
    [{ type: 'Action.OpenUrl', title: 'Open in LinkUP', url: `${WEB}/mentorships/${m.id}` }],
  );
}
