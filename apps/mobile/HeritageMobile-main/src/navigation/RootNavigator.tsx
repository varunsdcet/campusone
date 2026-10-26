import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, createNavigationContainerRef, CommonActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import type { Role } from '../domain/types';
import { Routes, RouteName } from './routes';
import { useSessionStore } from '../state/sessionStore';
import { useHydrated } from '../app/ServicesProvider';
import { useRestoreSession } from '../features/auth/useAuth';
import { SplashScreen } from '../features/auth/SplashScreen';
import { StudentTabs } from './StudentTabs';
import { InstructorTabs } from './InstructorTabs';
import { ApplicantTabs } from './ApplicantTabs';
import { screenFor, rootStackRoutes, publicRoutes } from './screens';
import { withRoleGate } from '../features/shared/RoleGate';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.cream, primary: colors.green900, card: colors.surface, text: colors.ink, border: colors.border } };

/** Safe reset to the role shell (used after login/logout/role switch). */
export function resetToShell(role: Role | null) {
  if (!navigationRef.isReady()) return;
  navigationRef.dispatch(CommonActions.reset({ index: 0, routes: [{ name: role ? shellFor(role) : Routes.Login }] }));
}

function shellFor(role: Role) {
  return role === 'student' ? Routes.StudentTabs : role === 'applicant' ? Routes.ApplicantTabs : Routes.InstructorTabs;
}

const gatedScreens = new Map<RouteName, React.ComponentType<object>>();
function gated(route: RouteName) {
  let c = gatedScreens.get(route);
  if (!c) {
    c = withRoleGate(route, screenFor(route));
    gatedScreens.set(route, c);
  }
  return c;
}

export function RootNavigator() {
  const status = useSessionStore(s => s.status);
  const role = useSessionStore(s => s.user?.role ?? null);
  const hydrated = useHydrated();
  const restore = useRestoreSession();

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => { void restore(); }, 900); // brief branded splash
    return () => clearTimeout(t);
  }, [hydrated, restore]);

  // Reset the stack whenever the signed-in role changes (login, logout, role switch).
  useEffect(() => {
    if (status === 'loading') return;
    resetToShell(status === 'signedIn' ? role : null);
  }, [status, role]);

  if (!hydrated || status === 'loading') return <SplashScreen />;

  return (
    <NavigationContainer ref={navigationRef} theme={theme}>
      <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_right' }} initialRouteName={status === 'signedIn' ? shellFor(role ?? 'instructor') : Routes.Login}>
        {status !== 'signedIn' ? (
          <Stack.Group>
            <Stack.Screen name={Routes.Login} component={screenFor(Routes.Login)} />
            <Stack.Screen name={Routes.ResetPassword} component={screenFor(Routes.ResetPassword)} />
            <Stack.Screen name={Routes.StudentSupport} component={screenFor(Routes.StudentSupport)} />
            <Stack.Screen name={Routes.DevGallery} component={screenFor(Routes.DevGallery)} />
            {publicRoutes.map(r => (
              <Stack.Screen key={r} name={r as keyof RootStackParamList} component={screenFor(r)} />
            ))}
          </Stack.Group>
        ) : (
          <Stack.Group>
            <Stack.Screen name={Routes.StudentTabs} component={StudentTabs} />
            <Stack.Screen name={Routes.InstructorTabs} component={InstructorTabs} />
            <Stack.Screen name={Routes.ApplicantTabs} component={ApplicantTabs} />
            {rootStackRoutes.map(r => (
              <Stack.Screen key={r} name={r as keyof RootStackParamList} component={gated(r)} options={r === Routes.FileViewer ? { presentation: 'modal' } : undefined} />
            ))}
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
