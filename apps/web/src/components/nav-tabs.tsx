'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface NavItem {
  href: string;
  label: string;
  badge?: number;
}

export function NavTabs({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  return (
    <nav className="sticky top-[60px] z-40 border-b bg-card">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2 border-b-[3px] px-3 py-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors',
              isActive(item.href)
                ? 'border-primary text-primary-text'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
            {item.badge ? (
              <span className="rounded-full bg-magenta px-1.5 py-px text-[10px] font-bold text-white">{item.badge}</span>
            ) : null}
          </Link>
        ))}
      </div>
    </nav>
  );
}
