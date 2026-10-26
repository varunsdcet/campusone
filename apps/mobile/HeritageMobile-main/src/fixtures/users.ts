import type { UserAccount, UserSettings, Contact } from '../domain/types';
import { DEMO_PASSWORD, IDS, ROSTER } from './constants';

const ALL_INSTRUCTOR_CAPS: UserAccount['capabilities'] = [
  'courses.manage', 'grades.submit', 'attendance.record', 'workshops.approve', 'registry.faculties',
  'registry.programTypes', 'registry.terms', 'repository.manage', 'schedules.review', 'students.directory',
];

function studentAccount(r: (typeof ROSTER)[number], extra: Partial<UserAccount['student']> = {}): UserAccount {
  return {
    id: r.id,
    role: 'student',
    loginId: r.number,
    demoPassword: DEMO_PASSWORD,
    displayName: `${r.first} ${r.last}`,
    firstName: r.first,
    lastName: r.last,
    email: r.email,
    avatarInitials: `${r.first[0]}${r.last[0]}`,
    capabilities: [],
    student: {
      studentNumber: r.number,
      programId: r.program === 'Computer Science' ? 'prog_cs' : r.program === 'Nursing' ? 'prog_nursing' : 'prog_business',
      programName: r.program === 'Computer Science' ? 'Computer Science (B.Sc.)' : r.program,
      catalogYear: '2024.1',
      advisorName: 'Jatinder Dhesi',
      phone: '(778) 555-0136',
      sensitiveIdMasked: '•••-•••-482',
      emergencyContactName: 'Demo Emergency Contact',
      emergencyContactPhone: '(587) 555-0198',
      ...extra,
    },
  };
}

export const users: UserAccount[] = [
  studentAccount(ROSTER[0], {
    phone: '(778) 676-6436',
    emergencyContactName: 'Ramalakshmi Ramsamy',
    emergencyContactPhone: '(587) 599-3998',
    advisorName: 'Jatinder Dhesi',
  }),
  ...ROSTER.slice(1).map(r => studentAccount(r)),
  {
    id: IDS.instructor,
    role: 'instructor',
    loginId: 'monica.dahiya@heritage.edu',
    demoPassword: DEMO_PASSWORD,
    displayName: 'Monica Dahiya',
    firstName: 'Monica',
    lastName: 'Dahiya',
    preferredName: 'Monica Dahiya',
    email: 'monica.dahiya@heritage.edu',
    avatarInitials: 'MD',
    capabilities: ALL_INSTRUCTOR_CAPS,
    instructor: {
      staffId: '22222222',
      department: 'Faculty',
      rank: 'Instructor',
      topics: ['Family systems', 'Addictions practice', 'Business ethics', 'Organizational behaviour'],
      availability: [
        { id: 'av1', day: 'Monday', from: '14:00', to: '16:00', mode: 'In person' },
        { id: 'av2', day: 'Wednesday', from: '10:00', to: '11:30', mode: 'Online' },
      ],
      compensation: { basis: 'Sessional (demo)', rateLabel: 'Synthetic rate band B', note: 'Demo values only — not a staff record.' },
      biography: 'Instructor in Applied Community Social Work with a focus on family systems and recovery-oriented practice.',
    },
  },
  {
    id: IDS.instructorPendelton,
    role: 'instructor',
    loginId: 'james.pendelton@heritage.edu',
    demoPassword: DEMO_PASSWORD,
    displayName: 'James Pendelton',
    firstName: 'James',
    lastName: 'Pendelton',
    email: 'james.pendelton@heritage.edu',
    avatarInitials: 'JP',
    capabilities: ['courses.manage', 'grades.submit', 'attendance.record'],
    instructor: {
      staffId: '22222231',
      department: 'Business',
      rank: 'Instructor',
      topics: ['Financial accounting'],
      availability: [],
      compensation: { basis: 'Sessional (demo)', rateLabel: 'Synthetic rate band B', note: 'Demo values only.' },
    },
  },
  {
    id: IDS.instructorSterling,
    role: 'instructor',
    loginId: 'ava.sterling@heritage.edu',
    demoPassword: DEMO_PASSWORD,
    displayName: 'Prof. Ava Sterling',
    firstName: 'Ava',
    lastName: 'Sterling',
    email: 'ava.sterling@heritage.edu',
    avatarInitials: 'AS',
    capabilities: ['courses.manage', 'grades.submit', 'attendance.record'],
    instructor: {
      staffId: '22222240',
      department: 'Computer Science',
      rank: 'Professor',
      topics: ['Algorithms', 'Data structures'],
      availability: [],
      compensation: { basis: 'Sessional (demo)', rateLabel: 'Synthetic rate band C', note: 'Demo values only.' },
    },
  },
];

export const settings: UserSettings[] = users.map(u => ({
  userId: u.id,
  timeZone: 'America/Vancouver',
  notificationsEnabled: true,
  extendedPermissionsDemo: u.id === IDS.instructor,
}));

export const contacts: Contact[] = [
  ...ROSTER.map(r => ({ id: r.id, name: `${r.first} ${r.last}`, email: r.email, role: 'student' as const })),
  { id: IDS.instructor, name: 'Monica Dahiya', email: 'monica.dahiya@heritage.edu', role: 'instructor' },
  { id: IDS.instructorPendelton, name: 'James Pendelton', email: 'james.pendelton@heritage.edu', role: 'instructor' },
  { id: IDS.instructorSterling, name: 'Prof. Ava Sterling', email: 'ava.sterling@heritage.edu', role: 'instructor' },
  { id: 'c_elena', name: 'Elena Vance', email: 'elena.vance@heritage.edu', role: 'staff' },
  { id: 'c_registrar', name: 'Registrar Services', email: 'registrar@heritage.edu', role: 'staff' },
  { id: 'c_advising', name: 'Academic Advising', email: 'advising@heritage.edu', role: 'staff' },
  { id: 'c_accounts', name: 'Student Accounts', email: 'accounts@heritage.edu', role: 'staff' },
];
