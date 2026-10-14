'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { rematchRequest } from '@/app/actions';
import { Button } from '@/components/ui/button';

export function RematchButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="lg"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await rematchRequest(requestId);
          if (!result.ok) toast.error(result.error);
          else {
            toast.success('Re-scored against the current mentor pool');
            router.refresh();
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Re-run match
    </Button>
  );
}
