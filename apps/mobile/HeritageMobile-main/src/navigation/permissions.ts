import type { Capability, Role, UserAccount, UserSettings } from '../domain/types';
import { Routes, RouteName } from './routes';
import { isMockMode } from '../config/appConfig';

/**
 * Route permission metadata. `role` restricts a route to one experience;
 * `capability` additionally requires a demo capability flag on the account.
 * Production authorisation must be enforced by the backend.
 */
export interface RoutePermission {
  role?: Role;
  capability?: Capability;
}

const studentPrefix = 'Student';
const instructorPrefix = 'Instructor';
const applicantPrefix = 'Applicant';

const capabilityRoutes: Partial<Record<RouteName, Capability>> = {
  [Routes.InstructorFaculties]: 'registry.faculties',
  [Routes.InstructorAddFaculty]: 'registry.faculties',
  [Routes.InstructorAddProgram]: 'registry.faculties',
  [Routes.InstructorProgramTypes]: 'registry.programTypes',
  [Routes.InstructorManageTerms]: 'registry.terms',
  [Routes.InstructorTermForm]: 'registry.terms',
  [Routes.InstructorRepository]: 'repository.manage',
  [Routes.InstructorCreateContentCourse]: 'repository.manage',
  [Routes.InstructorRepositoryHistory]: 'repository.manage',
  [Routes.InstructorPendingSchedules]: 'schedules.review',
  [Routes.InstructorScheduleReview]: 'schedules.review',
  [Routes.InstructorStudentList]: 'students.directory',
  [Routes.InstructorWorkshopEnrolments]: 'workshops.approve',
};

const sharedRoutes: RouteName[] = [Routes.StudentSecurity, Routes.StudentChangePassword, Routes.StudentSupport];

export function routePermission(route: RouteName): RoutePermission {
  const role: Role | undefined = sharedRoutes.includes(route) ? undefined : route.startsWith(studentPrefix) ? 'student' : route.startsWith(instructorPrefix) ? 'instructor' : route.startsWith(applicantPrefix) ? 'applicant' : undefined;
  return { role, capability: capabilityRoutes[route] };
}

export function hasCapability(user: UserAccount | null, settings: UserSettings | undefined, cap: Capability): boolean {
  if (!user) return false;
  if (isMockMode() && settings && settings.extendedPermissionsDemo === false && cap.startsWith('registry.')) return false;
  return user.capabilities.includes(cap);
}

export function canAccess(route: RouteName, user: UserAccount | null, settings?: UserSettings): { ok: boolean; reason?: string } {
  const perm = routePermission(route);
  if (!user) return { ok: false, reason: 'Sign in to continue.' };
  if (perm.role && perm.role !== user.role) return { ok: false, reason: `This screen is only available in the ${perm.role} experience.` };
  if (perm.capability && !hasCapability(user, settings, perm.capability)) return { ok: false, reason: `Requires the "${perm.capability}" capability (demo flag). Production authorisation must be confirmed by the backend.` };
  return { ok: true };
}
