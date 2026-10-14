'use client';

import { Check, CircleCheck, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { mentorshipAction } from '@/app/actions';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

type Permissions = { canApprove: boolean; canDecline: boolean; canCancel: boolean; canComplete: boolean };

export function MentorshipActions({
  id,
  permissions,
  status,
  menteeName,
  compact = false,
}: {
  id: string;
  permissions: Permissions;
  status: string;
  menteeName: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState('');
  const [declineOpen, setDeclineOpen] = useState(false);

  const act = (action: 'approve' | 'decline' | 'cancel' | 'complete', success: string) =>
    startTransition(async () => {
      const result = await mentorshipAction(id, action, action === 'decline' ? reason : undefined);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(success);
      setDeclineOpen(false);
      router.refresh();
    });

  const size = compact ? 'default' : 'lg';
  return (
    <div className="flex flex-wrap gap-2">
      {permissions.canApprove ? (
        <Button size={size} className="bg-success font-bold text-white hover:bg-success/90" disabled={pending} onClick={() => act('approve', `You're now mentoring ${menteeName}`)}>
          {pending ? <Loader2 className="animate-spin" /> : <Check />} Approve
        </Button>
      ) : null}
      {permissions.canDecline ? (
        <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
          <DialogTrigger asChild>
            <Button size={size} variant="outline" disabled={pending}>
              <X /> Decline
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Decline {menteeName}&apos;s request?</DialogTitle>
              <DialogDescription>They will be notified and can pick another mentor from their matches.</DialogDescription>
            </DialogHeader>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional reason (shared with the mentee)" />
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeclineOpen(false)}>
                Keep it
              </Button>
              <Button variant="destructive" disabled={pending} onClick={() => act('decline', 'Request declined')}>
                Decline request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      {permissions.canComplete ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size={size} variant="outline" disabled={pending}>
              <CircleCheck /> Mark completed
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Complete this mentorship?</AlertDialogTitle>
              <AlertDialogDescription>This frees the mentor&apos;s slot and closes the growth goal.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Not yet</AlertDialogCancel>
              <AlertDialogAction onClick={() => act('complete', 'Mentorship completed 🎉')}>Complete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
      {permissions.canCancel ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size={size} variant="ghost" className="text-destructive-text" disabled={pending}>
              {status === 'PENDING' ? 'Withdraw request' : 'Cancel mentorship'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{status === 'PENDING' ? 'Withdraw this request?' : 'Cancel this mentorship?'}</AlertDialogTitle>
              <AlertDialogDescription>
                {status === 'PENDING'
                  ? 'You can request a different mentor from your matches afterwards.'
                  : 'Both participants are notified and the slot is released.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => act('cancel', status === 'PENDING' ? 'Request withdrawn' : 'Mentorship cancelled')}>
                {status === 'PENDING' ? 'Withdraw' : 'Cancel mentorship'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
