import { cn } from '@/lib/utils';

const GRADIENTS = [
  'from-[#0A60FF] to-[#02C8FF]',
  'from-[#12b76a] to-[#0A60FF]',
  'from-[#FF9000] to-[#FF007F]',
  'from-[#7c3aed] to-[#0A60FF]',
  'from-[#02C8FF] to-[#12b76a]',
  'from-[#FF007F] to-[#7c3aed]',
];

function hash(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function PersonAvatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { sm: 'size-8 rounded-lg text-[11px]', md: 'size-11 rounded-xl text-sm', lg: 'size-14 rounded-2xl text-base' };
  return (
    <div
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center bg-gradient-to-br font-extrabold text-white',
        GRADIENTS[hash(name) % GRADIENTS.length],
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}
