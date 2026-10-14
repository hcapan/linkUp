import type { ProfileInput } from '@linkup/core';
import { PageHeader } from '@/components/page-header';
import { ProfileForm, type ManagerOption } from '@/components/profile-form';
import { api } from '@/lib/api';

const EMPTY: ProfileInput = {
  fullName: '',
  cecId: '',
  email: '',
  jobTitle: 'Systems Engineer',
  managerId: null,
  seRole: 'PORTFOLIO',
  specialistArch: null,
  theater: 'EMEAR',
  segment: 'SEG_COMMERCIAL',
  regionalSub: 'REG_GERMANY',
  timezone: 'Europe/Berlin',
  bio: '',
  certifications: [],
  isMentor: false,
  menteeCapacity: 1,
  skills: [],
  dealSizes: [],
  licensing: [],
  financial: [],
  stakeholder: [],
  competitors: [],
  formats: [],
};

export default async function NewProfilePage() {
  const managers = await api<ManagerOption[]>('/people/managers', { persona: null });
  return (
    <>
      <PageHeader
        eyebrow="Join LinkUP · profile intake"
        title="Register what you can teach — and what you want to learn"
        lead="One profile puts you in the matching pool. The same schema that scores you as a mentor powers your own growth requests. In the demo you'll be switched to this new person when you save."
      />
      <ProfileForm mode="create" initial={EMPTY} managers={managers} />
    </>
  );
}
