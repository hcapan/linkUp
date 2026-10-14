'use client';

import { Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { selectMentor } from '@/app/actions';
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

export function SelectMentorButton({
  requestId,
  mentorId,
  mentorName,
  primary,
}: {
  requestId: string;
  mentorId: string;
  mentorName: string;
  primary?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  const send = () =>
    startTransition(async () => {
      const result = await selectMentor(requestId, mentorId, message || undefined);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Request sent to ${mentorName}`, { description: 'They can approve from Webex or the web.' });
      setOpen(false);
      router.push(`/mentorships/${result.data.id}`);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          variant={primary ? 'default' : 'outline'}
          className={primary ? 'h-10 bg-success px-4 font-bold text-white hover:bg-success/90' : 'h-10 w-full font-bold'}
        >
          <Check /> Request mentorship
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request {mentorName} as your mentor</DialogTitle>
          <DialogDescription>
            They get an approval card in Webex and a notification here. Nothing is booked until they say yes.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Optional note — what you're working on, a live deal, what success looks like…"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={send} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Check />} Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
