import Link from 'next/link';
import {
  ArrowRight,
  Blocks,
  CalendarClock,
  Gauge,
  MessageSquare,
  Plug,
  Repeat,
  Rocket,
  Target,
  UserPlus,
} from 'lucide-react';
import { WEIGHTS } from '@linkup/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const PROBLEMS = [
  {
    icon: Blocks,
    tone: 'bg-cyan-soft text-cyan-text',
    title: 'The portfolio complexity gap',
    body: 'No single SE knows AI Fabrics, Observability, Security, and EA 3.0 at depth. Everyone needs targeted coaching, regardless of tenure.',
  },
  {
    icon: Plug,
    tone: 'bg-primary-soft text-primary-text',
    title: 'No official platform',
    body: 'Mentorship runs on ad-hoc personal networks. New hires, remote SEs, and smaller regions get left out; top mentors are invisible across pods.',
  },
  {
    icon: Repeat,
    tone: 'bg-magenta-soft text-magenta-text',
    title: 'Bi-directional by design',
    body: 'An AI Specialist coaches GPU clusters; a Portfolio SE coaches EA 3.0 pricing. One profile — everyone can give and get.',
  },
];

const STEPS = [
  { icon: UserPlus, title: '1 · Build your profile', body: 'Rate L1–L3 across 21 subcategories, commercial acumen, competitor takeouts, formats and capacity.' },
  { icon: Target, title: '2 · Ask for growth', body: 'Pick target subcategories, deal tier, competitor battle, coaching format — on the web or via the Webex bot.' },
  { icon: Gauge, title: '3 · Transparent match', body: 'The 100-point engine ranks every mentor with open slots and shows exactly why.' },
  { icon: MessageSquare, title: '4 · You choose, they approve', body: 'Request the mentor you want; they approve from Webex or the web. Nothing books without a yes.' },
  { icon: CalendarClock, title: '5 · Auto 1:1 space', body: 'On approval the bot creates a Webex space for the pair. Outlook cadence comes later.' },
  { icon: Rocket, title: '6 · Phased expansion', body: 'Same engine scales to AE-AE, SE-AE, leader and CX tracks.' },
];

export default function OverviewPage() {
  const categories = [
    ['Tech & subcategory', WEIGHTS.tech.max, 'bg-primary'],
    ['Business acumen', WEIGHTS.biz.max, 'bg-cyan'],
    ['Stakeholder & competitor', WEIGHTS.stakeholder.max, 'bg-success'],
    ['Coaching format & style', WEIGHTS.format.max, 'bg-warning'],
  ] as const;

  return (
    <div>
      <section className="relative mb-7 overflow-hidden rounded-[18px] bg-ink p-8 text-ink-foreground sm:p-10">
        <div className="pointer-events-none absolute -top-20 -right-20 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(2,200,255,.35),transparent_60%)]" />
        <div className="relative">
          <div className="text-[11px] font-extrabold tracking-[0.14em] text-cyan uppercase">
            Re-igniting the Cisco SE community spirit
          </div>
          <h1 className="mt-2.5 mb-3 text-3xl leading-tight font-bold sm:text-4xl">
            Every SE gets the right mentor.
            <br />
            Matched in seconds, on the web or in Webex.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-[#c9d4e2]">
            As the portfolio shifts across AI fabrics, Splunk, SASE and EA 3.0, LinkUP pairs mentees with proven
            mentors using a transparent 100-point match — and connects them in a Webex space once the mentor says yes.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {[
              ['100-pt', 'match engine'],
              ['21', 'tech subcategories'],
              ['Bi-directional', 'knowledge exchange'],
              ['Phase 1:', 'SE-to-SE · EMEAR'],
            ].map(([b, t]) => (
              <span key={t} className="rounded-full border border-white/15 bg-white/8 px-3.5 py-2 text-xs font-semibold">
                <b className="text-cyan">{b}</b> {t}
              </span>
            ))}
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-10 px-4 font-bold">
              <Link href="/find">
                Find a mentor <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-10 border-white/20 bg-transparent px-4 font-bold text-ink-foreground hover:bg-white/10 hover:text-ink-foreground dark:bg-transparent"
            >
              <Link href="/profile">Become a mentor</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {PROBLEMS.map(({ icon: Icon, tone, title, body }) => (
          <Card key={title} className="shadow-card">
            <CardContent>
              <div className={`mb-3 flex size-10 items-center justify-center rounded-[10px] ${tone}`}>
                <Icon size={20} />
              </div>
              <h3 className="mb-1.5 text-[15px] font-bold">{title}</h3>
              <p className="text-[13px] leading-relaxed text-muted-foreground">{body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="section-title">The journey</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body }) => (
          <Card key={title} className="shadow-card">
            <CardContent>
              <div className="mb-3 flex size-10 items-center justify-center rounded-[10px] bg-primary-soft text-primary-text">
                <Icon size={20} />
              </div>
              <h3 className="mb-1.5 text-[15px] font-bold">{title}</h3>
              <p className="text-[13px] leading-relaxed text-muted-foreground">{body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="section-title">How the 100 points split</h2>
      <Card className="shadow-card">
        <CardContent>
        <div className="grid gap-2.5">
          {categories.map(([label, max, color]) => (
            <div key={label} className="grid grid-cols-[170px_1fr_40px] items-center gap-3 text-xs font-semibold text-muted-foreground">
              <span>{label}</span>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${(max / 35) * 100}%` }} />
              </div>
              <span className="text-right text-foreground">{max}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-[10px] bg-muted px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
          <b className="text-foreground">Penalties & gates:</b> timezone gap &gt; 4h (−10), same pod / shared manager (−15), and a
          hard capacity gate that hides fully-booked mentors.{' '}
          <Link href="/scoring" className="font-semibold text-primary-text">
            See every rule →
          </Link>
        </p>
        </CardContent>
      </Card>
    </div>
  );
}
