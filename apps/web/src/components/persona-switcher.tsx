'use client';

import { ChevronDown, LogOut, ShieldCheck, Sparkles, UserPlus, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { searchPersonas, switchPersona } from '@/app/actions';
import { PersonAvatar } from '@/components/person-avatar';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Me, Persona } from '@/lib/types';

export function PersonaSwitcher({ me }: { me: Me | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [data, setData] = useState<{ featured: Persona[]; people: Persona[] }>({ featured: [], people: [] });
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      searchPersonas(query)
        .then(setData)
        .catch(() => setData({ featured: [], people: [] }));
    }, 180);
    return () => clearTimeout(handle);
  }, [open, query]);

  const choose = (id: string | null) =>
    startTransition(async () => {
      await switchPersona(id);
      setOpen(false);
      router.refresh();
    });

  const role = me?.isAdmin ? 'Program admin' : me?.isManager ? 'SE manager' : me?.isMentor ? 'Mentor' : me ? 'SE' : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 gap-2.5 rounded-xl border border-white/15 bg-white/5 px-2 text-ink-foreground hover:bg-white/10 hover:text-ink-foreground"
          disabled={pending}
        >
          {me ? (
            <>
              <PersonAvatar name={me.fullName} size="sm" className="size-7 rounded-md" />
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-[10px] font-semibold tracking-wide text-ink-muted uppercase">Viewing as · {role}</span>
                <span className="block text-[13px] font-semibold">{me.fullName}</span>
              </span>
            </>
          ) : (
            <>
              <Users className="size-4" />
              <span className="text-[13px] font-semibold">Choose a demo persona</span>
            </>
          )}
          <ChevronDown className="size-4 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search people by name, CEC ID or title…" value={query} onValueChange={setQuery} />
          <CommandList className="max-h-[420px]">
            <CommandEmpty>No people found.</CommandEmpty>
            {!query && data.featured.length > 0 && (
              <CommandGroup heading="Suggested demo personas">
                {data.featured.map((p) => (
                  <CommandItem key={`f-${p.id}`} value={`f-${p.id}`} onSelect={() => choose(p.id)} className="items-start gap-3 py-2">
                    <Sparkles className="mt-0.5 text-primary-text" />
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold">
                        {p.label} · <span className="font-normal">{p.fullName}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{p.description}</div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {data.people.length > 0 && (
              <CommandGroup heading={query ? 'People' : 'Recently updated'}>
                {data.people.map((p) => (
                  <CommandItem key={p.id} value={p.id} onSelect={() => choose(p.id)} className="gap-3">
                    <PersonAvatar name={p.fullName} size="sm" className="size-7 rounded-md text-[10px]" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold">
                        {p.fullName} <span className="font-normal text-muted-foreground">· {p.cecId}</span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{p.jobTitle}</div>
                    </div>
                    {p.isAdmin ? <ShieldCheck className="text-magenta-text" /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="__new"
                onSelect={() => {
                  setOpen(false);
                  router.push('/profile/new');
                }}
              >
                <UserPlus /> Create a new profile
              </CommandItem>
              {me ? (
                <CommandItem value="__clear" onSelect={() => choose(null)}>
                  <LogOut /> Stop viewing as {me.fullName.split(' ')[0]}
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
