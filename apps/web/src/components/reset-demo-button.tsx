'use client';

import { Loader2, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { resetDemoData } from '@/app/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export function ResetDemoButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const reset = () =>
    startTransition(async () => {
      const result = await resetDemoData();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Demo data regenerated (${result.data.people} people). Pick a persona to continue.`);
      router.push('/');
      router.refresh();
    });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="lg" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />} Reset demo data
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset all demo data?</AlertDialogTitle>
          <AlertDialogDescription>
            Every profile, request and mentorship is replaced with a freshly generated fictional dataset. People created
            during the demo are removed and everyone has to pick a persona again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep current data</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={reset}>
            Reset demo data
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
