/**
 * Route → screen component registry. Importing screens through one module keeps
 * the navigators thin and makes the developer gallery trivial to build.
 */
import type React from 'react';
import { Routes, RouteName } from './routes';
import { PlaceholderScreen } from '../features/shared/PlaceholderScreen';
import { ForbiddenView } from '../features/shared/RoleGate';
import { LoginScreen } from '../features/auth/LoginScreen';
import { ResetPasswordScreen } from '../features/auth/ResetPasswordScreen';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyScreen = React.ComponentType<any>;

const registry: Partial<Record<RouteName, AnyScreen>> = {
  [Routes.Login]: LoginScreen,
  [Routes.ResetPassword]: ResetPasswordScreen,
  [Routes.Forbidden]: ForbiddenView,
};

export function screenFor(route: RouteName): AnyScreen {
  return registry[route] ?? PlaceholderScreen;
}

export function registerScreens(entries: Partial<Record<RouteName, AnyScreen>>) {
  Object.assign(registry, entries);
}

/** Signed-out flows reachable from the Login screen. */
export const publicRoutes: RouteName[] = [Routes.PublicApply, Routes.PublicApplySuccess, Routes.PublicEnglishTest, Routes.PublicEnglishTestDone, Routes.PublicSelfPaced, Routes.PublicSelfPacedDetails, Routes.PublicSelfPacedRegister];

/** Root-stack routes (everything except tab shells and Splash). */
export const rootStackRoutes: RouteName[] = (Object.values(Routes) as RouteName[]).filter(r =>
  !publicRoutes.includes(r) && ![Routes.Splash, Routes.StudentTabs, Routes.InstructorTabs, Routes.StudentHomeTab, Routes.StudentCoursesTab, Routes.StudentScheduleTab, Routes.StudentMessagesTab, Routes.StudentProfileTab, Routes.InstructorHomeTab, Routes.InstructorCoursesTab, Routes.InstructorGradesTab, Routes.InstructorMessagesTab, Routes.InstructorMoreTab, Routes.ApplicantTabs, Routes.ApplicantHomeTab, Routes.ApplicantApplicationTab, Routes.ApplicantDocumentsTab, Routes.ApplicantMessagesTab, Routes.ApplicantMoreTab, Routes.Login].includes(r as never),
);
