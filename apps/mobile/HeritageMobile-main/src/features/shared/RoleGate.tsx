import React from 'react';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { Screen, ScreenHeader, EmptyState, Button, Stack, Text, InfoBanner, Icon } from '../../components';
import { colors } from '../../theme';
import { useSessionStore } from '../../state/sessionStore';
import { canAccess } from '../../navigation/permissions';
import { Routes, type RouteName } from '../../navigation/routes';
import { useSettings } from '../auth/useAuth';

export function ForbiddenView({ reason }: { reason?: string }) {
  const navigation = useNavigation();
  const role = useSessionStore(s => s.user?.role);
  const home = role === 'instructor' ? Routes.InstructorTabs : role === 'student' ? Routes.StudentTabs : role === 'applicant' ? Routes.ApplicantTabs : null;
  const goHome = () => {
    if (home) navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: home }] }));
  };
  return (
    <Screen scroll={false} header={<ScreenHeader title="Not available" />} testID="forbidden-screen">
      <Stack>
        <EmptyState icon="ShieldAlert" title="You can't open this screen" message="Your account doesn't have permission to view this page." testID="forbidden-message" />
        <InfoBanner tone="grey" icon="Info" title="Reason" text={reason ?? 'This screen is not available for your role.'} />
        <Text variant="caption" align="center">If you think you should have access, contact Student Services or your campus administrator.</Text>
        {home ? <Button title="Back to home" icon={<Icon name="House" size={16} color={colors.white} />} onPress={goHome} testID="forbidden-home" /> : null}
        {navigation.canGoBack() ? <Button title="Go back" variant="outline" onPress={() => navigation.goBack()} testID="forbidden-back" /> : null}
      </Stack>
    </Screen>
  );
}

/**
 * Wraps a screen with role/capability enforcement using centralised permission
 * metadata. Forbidden navigation renders an explanatory screen instead of data.
 */
export function withRoleGate<P extends object>(route: RouteName, Component: React.ComponentType<P>): React.ComponentType<P> {
  return function Gated(props: P) {
    const user = useSessionStore(s => s.user);
    const settings = useSettings();
    const check = canAccess(route, user, settings.data);
    if (!check.ok) return <ForbiddenView reason={check.reason} />;
    return <Component {...props} />;
  };
}
