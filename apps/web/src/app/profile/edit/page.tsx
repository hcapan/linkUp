import { redirect } from 'next/navigation';
import type { ProfileInput } from '@linkup/core';
import { PageHeader } from '@/components/page-header';
import { ProfileForm, type ManagerOption } from '@/components/profile-form';
import { api, getMe } from '@/lib/api';
import type { PersonProfile } from '@/lib/types';

export default async function EditProfilePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const me = await getMe();
  if (!me) redirect('/profile');
  const { id } = await searchParams;
  const [p, managers] = await Promise.all([api<PersonProfile>(`/people/${id ?? me.id}`), api<ManagerOption[]>('/people/managers')]);
  if (!p.canEdit) redirect(`/people/${p.id}`);

  const initial: ProfileInput = {
    fullName: p.fullName,
    cecId: p.cecId,
    email: p.email,
    jobTitle: p.jobTitle,
    managerId: p.managerId,
    seRole: p.seRole ?? 'PORTFOLIO',
    specialistArch: p.specialistArch,
    theater: p.theater ?? 'EMEAR',
    segment: p.segment ?? 'SEG_COMMERCIAL',
    regionalSub: p.regionalSub ?? 'REG_GERMANY',
    timezone: p.timezone ?? 'Europe/Berlin',
    bio: p.bio,
    certifications: p.certifications,
    isMentor: p.isMentor,
    menteeCapacity: (p.menteeCapacity === 2 ? 2 : 1) as 1 | 2,
    skills: p.skills.map((s) => ({ subcategory: s.subcategory, level: s.level as 1 | 2 | 3 })),
    dealSizes: p.dealSizes,
    licensing: p.licensing,
    financial: p.financial,
    stakeholder: p.stakeholder,
    competitors: p.competitors,
    formats: p.formats,
  };

  return (
    <>
      <PageHeader
        eyebrow={p.id === me.id ? 'My profile · edit' : `Editing ${p.fullName} (admin)`}
        title="Profile intake"
        lead="Changes take effect on the next match. Your superpower bio is re-embedded on save."
      />
      <ProfileForm mode="edit" personId={p.id} initial={initial} managers={managers.filter((m) => m.id !== p.id)} />
    </>
  );
}
