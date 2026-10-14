import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import Link from 'next/link';
import { NavTabs, type NavItem } from '@/components/nav-tabs';
import { PersonaSwitcher } from '@/components/persona-switcher';
import { Providers } from '@/components/providers';
import { ThemeToggle } from '@/components/theme-toggle';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getMe } from '@/lib/api';
import type { Me } from '@/lib/types';
import { cn } from '@/lib/utils';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Cisco SE LinkUP',
  description: 'Mentor–mentee matching for the Cisco SE community',
};

async function loadMe(): Promise<Me | null> {
  try {
    return await getMe();
  } catch {
    return null;
  }
}

function navFor(me: Me | null): NavItem[] {
  const items: NavItem[] = [
    { href: '/', label: 'Overview' },
    { href: '/find', label: 'Find a mentor' },
    { href: '/mentorships', label: 'My mentorships', badge: me?.pendingApprovals || undefined },
    { href: '/people', label: 'Mentor directory' },
    { href: '/profile', label: 'My profile' },
  ];
  if (me?.isAdmin) items.push({ href: '/dashboard', label: 'Program dashboard' });
  else if (me?.isManager) items.push({ href: '/dashboard', label: 'Team dashboard' });
  items.push({ href: '/scoring', label: 'How matching works' });
  return items;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await loadMe();
  return (
    <html lang="en" suppressHydrationWarning className={cn('font-sans', geist.variable)}>
      <body className="min-h-screen">
        <Providers>
          <TooltipProvider>
            <header className="sticky top-0 z-50 h-[60px] bg-ink text-ink-foreground shadow-[0_2px_8px_rgba(7,24,45,.25)]">
              <div className="mx-auto flex h-full max-w-6xl items-center gap-4 px-4 sm:px-6">
                <Link href="/" className="flex items-center gap-2.5 text-[17px] font-extrabold tracking-wide">
                  <span className="size-2.5 rounded-full bg-cyan shadow-[0_0_0_4px_rgba(2,200,255,.25)]" />
                  Cisco SE <span className="text-cyan">LinkUP</span>
                </Link>
                <span className="hidden border-l border-white/20 pl-4 text-[11px] text-ink-muted md:block">
                  Mentorship matching · Demo environment
                </span>
                <div className="flex-1" />
                <PersonaSwitcher me={me} />
                <ThemeToggle />
              </div>
            </header>
            <NavTabs items={navFor(me)} />
            <main className="mx-auto max-w-6xl px-4 pt-7 pb-20 sm:px-6">{children}</main>
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
