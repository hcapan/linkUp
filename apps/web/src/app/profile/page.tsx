import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { PersonaRequired } from '@/components/persona-required';
import { getMe } from '@/lib/api';

export default async function MyProfilePage() {
  const me = await getMe();
  if (me) redirect(`/people/${me.id}`);
  return (
    <>
      <PageHeader eyebrow="My profile" title="Your LinkUP profile" />
      <PersonaRequired what="your profile" />
    </>
  );
}
