import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen, Text, Card, Row, Stack, Button, ListRow, Pill, Avatar, ConfirmSheet, DemoLabel, Icon, Toggle, InfoBanner } from '../../../components';
import { spacing, colors } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import { useCurrentUser } from '../../../state/sessionStore';
import { instructorMoreMenu } from '../../../navigation/menus';
import { Routes } from '../../../navigation/routes';
import type { InstructorTabProps } from '../../../navigation/types';
import { useLogout, useSettings, useUpdateSettings } from '../../auth/useAuth';
import { useAppNavigation, navigateTo } from '../../../navigation/hooks';
import { hasCapability } from '../../../navigation/permissions';

/** Instructor More tab – exposes every remaining supplied module. */
export function MoreScreen(_props: InstructorTabProps<'InstructorMoreTab'>) {
  const user = useCurrentUser();
  const navigation = useAppNavigation();
  const logout = useLogout();
  const settings = useSettings();
  const update = useUpdateSettings();
  const [confirm, setConfirm] = useState(false);
  const groups = Array.from(new Set(instructorMoreMenu.map(m => m.group)));
  const extended = settings.data?.extendedPermissionsDemo !== false;
  const mock = isMockMode();
  return (
    <Screen testID="instructor-more" bottomInset={false}>
      <Card tone="dark" style={{ marginTop: spacing.sm }}>
        <Row gap={spacing.md}><Avatar initials={user.avatarInitials} size={52} bg={colors.gold500} fg={colors.green900} /><View style={{ flex: 1 }}><Text variant="displaySm" color={colors.white}>{user.displayName}</Text><Text variant="bodySm" color={colors.green100}>{user.email}</Text></View></Row>
        <Row style={{ marginTop: spacing.md }}><Pill label="Instructor" tone="gold" small />{mock ? <Pill label={extended ? 'Extended registry demo: ON' : 'Registry demo: OFF'} tone={extended ? 'green' : 'grey'} small /> : null}</Row>
      </Card>
      <Stack style={{ marginTop: spacing.md }}>
        {mock ? <Card tone="gold" padding={spacing.md}>
          <Toggle label="Extended-permissions instructor demo" value={extended} onChange={v => update.mutate({ extendedPermissionsDemo: v })} testID="more-extended-toggle" />
          <Text variant="caption">Demo capability flag that unlocks Faculties & Programs, Program Types and Manage Terms. Production authorization must be confirmed and enforced by the backend.</Text>
        </Card> : null}
        {groups.map(g => (
          <Card key={g} padding={spacing.md}>
            <Text variant="overline" style={{ marginBottom: 4 }}>{g}</Text>
            {instructorMoreMenu.filter(m => m.group === g && !(m.liveOnly && mock)).map(m => {
              const allowed = !m.capability || hasCapability(user, settings.data, m.capability);
              return <ListRow key={m.key} icon={m.icon} title={m.label} subtitle={allowed ? m.description : mock ? `Requires "${m.capability}" (demo flag)` : `Requires "${m.capability}"`} right={!allowed ? <Icon name="Lock" size={16} color={colors.inkMuted} /> : m.capability && mock ? <Pill label="demo cap." tone="gold" small /> : undefined} onPress={() => navigateTo(navigation, m.route, m.params)} testID={`more-${m.key}`} />;
            })}
          </Card>
        ))}
        {mock ? <InfoBanner tone="grey" icon="Info" text="Locked items still open and show a Forbidden screen — this demonstrates the permission gate without hiding supplied modules." /> : null}
        {mock ? <Card padding={spacing.md}><Text variant="overline" style={{ marginBottom: 4 }}>Developer</Text><ListRow icon="Wrench" title="Developer gallery & scenarios" subtitle="QA shortcut · reset demo data" onPress={() => navigation.navigate(Routes.DevGallery)} testID="more-devgallery" /></Card> : null}
        <Button title="Sign out" variant="outline" onPress={() => setConfirm(true)} testID="more-logout" />
        <DemoLabel text="Inferred hub screen" />
      </Stack>
      <ConfirmSheet visible={confirm} onClose={() => setConfirm(false)} onConfirm={() => { setConfirm(false); void logout(); }} title="Sign out?" message="Session caches will be cleared. Shared demo records stay for cross-role testing." confirmLabel="Sign out" icon="LogOut" testID="logout-sheet" />
    </Screen>
  );
}

export const moreStyles = StyleSheet.create({});
