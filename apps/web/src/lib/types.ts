import type { MatchBreakdown } from '@linkup/core';

export type { MatchBreakdown };

export interface SkillRating {
  subcategory: string;
  level: number;
}

export interface PersonSummary {
  id: string;
  fullName: string;
  cecId: string;
  jobTitle: string;
  seRole: string | null;
  specialistArch: string | null;
  regionalSub: string | null;
  segment: string | null;
  timezone: string | null;
  isMentor: boolean;
  menteeCapacity: number;
  activeMentees: number;
  bio: string;
  topSkills: SkillRating[];
}

export interface PersonProfile extends Omit<PersonSummary, 'topSkills'> {
  email: string;
  managerId: string | null;
  manager: { id: string; fullName: string; jobTitle: string } | null;
  webexEmail: string | null;
  isAdmin: boolean;
  theater: string | null;
  skills: SkillRating[];
  dealSizes: string[];
  licensing: string[];
  financial: string[];
  stakeholder: string[];
  competitors: string[];
  formats: string[];
  certifications: string[];
  directReports: number;
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Me extends PersonSummary {
  isAdmin: boolean;
  isManager: boolean;
  directReports: number;
  webexEmail: string | null;
  pendingApprovals: number;
  openAsMentee: number;
  activeAsMentor: number;
  openRequests: number;
}

export interface Persona {
  id: string;
  fullName: string;
  cecId: string;
  jobTitle: string;
  label?: string;
  description?: string;
  isMentor?: boolean;
  isAdmin?: boolean;
  isManager?: boolean;
}

export interface PersonLite {
  id: string;
  fullName: string;
  cecId: string;
  jobTitle: string;
  regionalSub: string | null;
  segment: string | null;
  timezone: string | null;
  managerId: string | null;
  webexLinked: boolean;
}

export type MentorshipStatus = 'PENDING' | 'ACTIVE' | 'DECLINED' | 'CANCELLED' | 'COMPLETED';

export interface Mentorship {
  id: string;
  requestId: string | null;
  status: MentorshipStatus;
  matchScore: number | null;
  focus: string;
  message: string | null;
  declineReason: string | null;
  requestedAt: string;
  respondedAt: string | null;
  startedAt: string | null;
  endsAt: string | null;
  completedAt: string | null;
  webexRoomId: string | null;
  webexRoomTitle: string | null;
  progress: number;
  mentee: PersonLite;
  mentor: PersonLite;
}

export interface MentorshipDetail extends Mentorship {
  breakdown: MatchBreakdown | null;
  goal: string | null;
  targetSubcategories: string[];
  viewerRole: 'mentee' | 'mentor' | 'admin' | 'manager';
  permissions: { canApprove: boolean; canDecline: boolean; canCancel: boolean; canComplete: boolean };
  program: { months: number; label: string; cadence: string };
}

export interface MatchView {
  rank: number;
  score: number;
  strong: boolean;
  breakdown: MatchBreakdown;
  mentor: PersonSummary | null;
  mentorships: { id: string; status: MentorshipStatus }[];
}

export interface RequestDetail {
  id: string;
  menteeId: string;
  mentee: PersonSummary | null;
  primaryArch: string;
  targetSubcategories: string[];
  commercialSkills: string[];
  stakeholderInterests: string[];
  dealSize: string | null;
  competitors: string[];
  formats: string[];
  goal: string;
  status: 'OPEN' | 'MATCHED' | 'CLOSED';
  channel: string;
  algorithmVersion: string;
  evaluated: number;
  excluded: Record<string, number>;
  createdAt: string;
  isOwner: boolean;
  openMentorship: { id: string; mentorId: string; status: MentorshipStatus } | null;
  matches: MatchView[];
}

export interface RequestListItem {
  id: string;
  primaryArch: string;
  targetSubcategories: string[];
  goal: string;
  status: string;
  channel: string;
  createdAt: string;
  topScore: number | null;
  matches: number;
  mentorshipStatus: MentorshipStatus | null;
}

export interface Dashboard {
  scope: 'program' | 'team';
  kpis: {
    people: number;
    mentors: number;
    activePairs: number;
    pending: number;
    completed: number;
    closed: number;
    avgMatchScore: number | null;
    slotUtilization: number | null;
    openSlots: number;
    requests30d: number;
    avgResponseHours: number | null;
  };
  coverage: { arch: string; label: string; l3Mentors: number; l2Mentors: number; openSlots: number; demand: number }[];
  topSubcategories: { code: string; requests: number; l3Mentors: number }[];
  regions: { region: string; people: number; mentors: number; activePairs: number }[];
  recent: Mentorship[];
}
