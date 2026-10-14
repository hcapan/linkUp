/**
 * LinkUP Webex bot.
 *
 * Runs in WebSocket mode: the framework opens an outbound connection to Webex,
 * so no public URL, webhook, tunnel or ngrok is needed. Card submissions arrive
 * as `attachmentAction` events on the same socket.
 *
 * Responsibilities
 *  - Commands: help · find mentor · my mentorships · link <cec-id> · whoami
 *  - Mentee growth query card → POST /requests → top-3 matches card
 *  - Delivers outbox events: approval cards to mentors, results to mentees,
 *    and creates a 1:1 Webex space when a mentorship is approved.
 *
 * Run a single instance in WebSocket mode (two instances would both receive
 * every event). For production, switch to webhooks behind a stable HTTPS URL.
 */
import Framework from 'webex-node-bot-framework';
import { ApiError, api, personByEmail, type BotMentorship } from './api.js';
import { approvalCard, introCard, matchesCard, menteeQueryCard, type MatchForCard } from './cards.js';

const token = process.env.WEBEX_BOT_TOKEN;
const WEB = process.env.WEB_BASE_URL ?? 'http://localhost:5050';
const POLL_MS = 3000;

if (!token) {
  console.log(`
LinkUP Webex bot is not configured.

  1. Create a bot at https://developer.webex.com/my-apps  (New App → Create a Bot)
  2. Put its access token in .env:  WEBEX_BOT_TOKEN=...
  3. pnpm dev:bot

The bot uses WebSockets — no public URL or ngrok required.
`);
  process.exit(0);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Bot = any;
type Trigger = any;

const framework = new (Framework as any)({ token, messageFormat: 'markdown' });

const emailOf = (trigger: Trigger): string => trigger.person?.emails?.[0] ?? trigger.personEmail;

async function whoIs(bot: Bot, trigger: Trigger) {
  const email = emailOf(trigger);
  const person = await personByEmail(email);
  if (!person) {
    await bot.say(
      'markdown',
      `I don't know **${email}** yet. In the demo, link your Webex account to any LinkUP persona:\n\n` +
        '`link <cec-id>` — e.g. `link mellis` (program admin). Find CEC IDs in the web app.',
    );
  }
  return person;
}

const errorText = (err: unknown) =>
  err instanceof ApiError
    ? `${err.message}${err.issues?.length ? `\n\n${err.issues.map((i) => `• ${i.path}: ${i.message}`).join('\n')}` : ''}`
    : `Something went wrong: ${(err as Error).message}`;

const splitList = (v: unknown) =>
  typeof v === 'string' && v.trim() ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];

/* ------------------------------ commands ------------------------------ */

const HELP = [
  '**LinkUP — SE mentorship matching**',
  '',
  '• `find mentor` — send me your growth goal, get your top 3 mentors',
  '• `my mentorships` — your current pairings and requests',
  '• `link <cec-id>` — (demo) connect your Webex account to a LinkUP persona',
  '• `whoami` — which LinkUP person you are linked to',
  `• Full profile & dashboard: ${WEB}`,
].join('\n');

framework.hears(/^(help|hi|hello|start)\b/i, (bot: Bot) => bot.say('markdown', HELP), '**help** — what I can do', 0);

framework.hears(
  /^link\s+(\S+)/i,
  async (bot: Bot, trigger: Trigger) => {
    const cecId = trigger.args[1];
    try {
      const person = await api<{ fullName: string; cecId: string }>('/bot/link', {
        method: 'POST',
        body: { email: emailOf(trigger), cecId },
      });
      await bot.say('markdown', `✅ Linked to **${person.fullName}** (${person.cecId}). Try \`find mentor\`.`);
    } catch (err) {
      await bot.say('markdown', errorText(err));
    }
  },
  '**link <cec-id>** — connect to a demo persona',
  0,
);

framework.hears(/^whoami\b/i, async (bot: Bot, trigger: Trigger) => {
  const person = await whoIs(bot, trigger);
  if (person) await bot.say('markdown', `You are **${person.fullName}** (${person.cecId})${person.isMentor ? ' · mentor' : ''}.`);
});

framework.hears(/^(find|mentor|find (a )?mentor)\b/i, async (bot: Bot, trigger: Trigger) => {
  if (!(await whoIs(bot, trigger))) return;
  await bot.sendCard(menteeQueryCard(), 'Your client cannot render cards — use the web app to find a mentor.');
});

framework.hears(/^(my )?mentorships?\b/i, async (bot: Bot, trigger: Trigger) => {
  const person = await whoIs(bot, trigger);
  if (!person) return;
  const list = await api<{ id: string; status: string; focus: string; matchScore: number; mentee: { id: string; fullName: string }; mentor: { fullName: string } }[]>(
    '/mentorships?scope=mine',
    { as: person.id },
  );
  if (!list.length) return bot.say('markdown', 'No mentorships yet — say `find mentor` to start.');
  const lines = list.slice(0, 10).map((m) => {
    const other = m.mentee.id === person.id ? `mentor **${m.mentor.fullName}**` : `mentee **${m.mentee.fullName}**`;
    return `• ${m.status} · ${other} · ${m.focus || '—'} · ${m.matchScore}% — ${WEB}/mentorships/${m.id}`;
  });
  await bot.say('markdown', lines.join('\n'));
});

framework.hears(
  /.*/,
  (bot: Bot, trigger: Trigger) => bot.say('markdown', `Sorry, I didn't get “${trigger.text}”.\n\n${HELP}`),
  99999,
);

/* ---------------------------- card actions ---------------------------- */

framework.on('attachmentAction', async (bot: Bot, trigger: Trigger) => {
  const inputs = trigger.attachmentAction.inputs ?? {};
  const person = await whoIs(bot, trigger);
  if (!person) return;
  try {
    if (inputs.action === 'request') {
      const request = await api<{ id: string; evaluated: number; matches: MatchForCard[] }>('/requests?channel=webex', {
        method: 'POST',
        as: person.id,
        body: {
          primaryArch: inputs.primaryArch,
          targetSubcategories: splitList(inputs.targetSubcategories),
          commercialSkills: splitList(inputs.commercialSkills),
          stakeholderInterests: [],
          dealSize: inputs.dealSize || null,
          competitors: splitList(inputs.competitors),
          formats: splitList(inputs.formats),
          goal: inputs.goal ?? '',
        },
      });
      if (!request.matches.length) return bot.reply(trigger.attachmentAction, 'Every matching mentor is fully booked right now — try broadening your subcategories.');
      await bot.sendCard(matchesCard(request.id, request.matches, request.evaluated), `Top matches: ${WEB}/requests/${request.id}`);
    } else if (inputs.action === 'select') {
      await api(`/requests/${inputs.requestId}/select`, { method: 'POST', as: person.id, body: { mentorId: inputs.mentorId } });
      await bot.reply(trigger.attachmentAction, '📨 Request sent. The mentor gets an approval card; I will let you know when they respond.');
    } else if (inputs.action === 'approve') {
      await api(`/mentorships/${inputs.mentorshipId}/approve`, { method: 'POST', as: person.id });
      await bot.reply(trigger.attachmentAction, '✅ Approved — I am creating your 1:1 space now.');
    } else if (inputs.action === 'decline') {
      await api(`/mentorships/${inputs.mentorshipId}/decline`, { method: 'POST', as: person.id, body: { reason: inputs.reason || undefined } });
      await bot.reply(trigger.attachmentAction, 'Declined. The mentee can pick another mentor from their matches.');
    }
  } catch (err) {
    await bot.reply(trigger.attachmentAction, errorText(err));
  }
});

/* ------------------------------- outbox ------------------------------- */

interface OutboxEvent {
  id: number;
  type: string;
  payload: { mentorshipId: string; by?: string };
}

async function dm(email: string | null, markdown: string, cardJson?: Record<string, unknown>) {
  if (!email) return;
  await framework.webex.messages.create({
    toPersonEmail: email,
    markdown,
    ...(cardJson ? { attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: cardJson }] } : {}),
  });
}

async function createSpace(m: BotMentorship) {
  if (m.webexRoomId) return;
  const members = [m.mentee.webexEmail, m.mentor.webexEmail].filter((e): e is string => !!e);
  if (members.length === 0) return;
  const title = `LinkUP · ${m.mentee.fullName} ↔ ${m.mentor.fullName}`;
  const room = await framework.webex.rooms.create({ title });
  for (const personEmail of [...new Set(members.map((e) => e.toLowerCase()))]) {
    await framework.webex.memberships.create({ roomId: room.id, personEmail }).catch((err: Error) => {
      console.warn(`[bot] could not add ${personEmail} to ${title}: ${err.message}`);
    });
  }
  await framework.webex.messages.create({
    roomId: room.id,
    markdown: `Welcome to your LinkUP mentorship — ${m.mentee.fullName} ↔ ${m.mentor.fullName}`,
    attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: introCard(m) }],
  });
  await api(`/bot/mentorships/${m.id}/room`, { method: 'PATCH', body: { roomId: room.id, title } });
}

async function deliver(event: OutboxEvent) {
  const m = await api<BotMentorship>(`/bot/mentorships/${event.payload.mentorshipId}`);
  switch (event.type) {
    case 'MENTORSHIP_REQUESTED':
      await dm(m.mentor.webexEmail, `New mentorship request from ${m.mentee.fullName}`, approvalCard(m));
      break;
    case 'MENTORSHIP_APPROVED':
      await dm(m.mentee.webexEmail, `🎉 **${m.mentor.fullName}** approved your mentorship request. Your 1:1 space is on its way.`);
      await createSpace(m);
      break;
    case 'MENTORSHIP_DECLINED':
      await dm(
        m.mentee.webexEmail,
        `${m.mentor.fullName} declined your request${m.declineReason ? `: “${m.declineReason}”` : ''}. Pick another mentor: ${WEB}/mentorships/${m.id}`,
      );
      break;
    case 'MENTORSHIP_CANCELLED': {
      const byMentee = event.payload.by === m.mentee.id;
      await dm(byMentee ? m.mentor.webexEmail : m.mentee.webexEmail, `The mentorship between ${m.mentee.fullName} and ${m.mentor.fullName} was cancelled.`);
      break;
    }
    case 'MENTORSHIP_COMPLETED':
      for (const email of [m.mentee.webexEmail, m.mentor.webexEmail]) {
        await dm(email, `🎓 Mentorship ${m.mentee.fullName} ↔ ${m.mentor.fullName} completed. Thank you for giving back!`);
      }
      break;
  }
}

let polling = false;
async function pollOutbox() {
  if (polling) return;
  polling = true;
  try {
    const events = await api<OutboxEvent[]>('/bot/outbox?limit=20');
    for (const event of events) {
      try {
        await deliver(event);
        await api(`/bot/outbox/${event.id}/ack`, { method: 'POST', body: {} });
      } catch (err) {
        console.error(`[bot] event ${event.id} ${event.type} failed:`, (err as Error).message);
        await api(`/bot/outbox/${event.id}/ack`, { method: 'POST', body: { error: (err as Error).message } }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[bot] outbox poll failed:', (err as Error).message);
  } finally {
    polling = false;
  }
}

/* ------------------------------- start -------------------------------- */

framework.on('initialized', () => {
  console.log(`[bot] LinkUP bot online as ${framework.email} (WebSocket mode — no public URL needed)`);
  setInterval(pollOutbox, POLL_MS);
});

framework.on('spawn', (bot: Bot, _id: string, addedBy?: string) => {
  if (addedBy && bot.room.type === 'direct') bot.say('markdown', HELP);
});

framework.on('log', (msg: string) => {
  if (process.env.BOT_DEBUG) console.log('[framework]', msg);
});

process.on('SIGINT', async () => {
  console.log('[bot] stopping…');
  await framework.stop();
  process.exit(0);
});

await framework.start();
