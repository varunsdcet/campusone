import React, { useState } from 'react';
import { View } from 'react-native';
import { Screen, Text, Card, Stack, ListRow, Row, Avatar, Pill, Button, ConfirmSheet, DemoLabel, Icon } from '../../../components';
import { spacing, colors } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import { useCurrentUser } from '../../../state/sessionStore';
import { studentServicesMenu } from '../../../navigation/menus';
import { Routes } from '../../../navigation/routes';
import type { StudentTabProps } from '../../../navigation/types';
import { useLogout } from '../../auth/useAuth';
import { useAppNavigation, navigateTo } from '../../../navigation/hooks';

/** Profile tab doubles as the student services hub (inferred supporting screen). */
export function StudentProfileScreen(_props: StudentTabProps<'StudentProfileTab'>) {
  const user = useCurrentUser();
  const navigation = useAppNavigation();
  const logout = useLogout();
  const [confirm, setConfirm] = useState(false);
  const mock = isMockMode();
  const menu = studentServicesMenu.filter(m => !(m.liveOnly && mock));
  const groups = Array.from(new Set(menu.map(m => m.group)));
  return (
    <Screen testID="student-profile" bottomInset={false}>
      <Card tone="dark" style={{ marginTop: spacing.sm }}>
        <Row gap={spacing.md}>
          <Avatar initials={user.avatarInitials} size={56} bg={colors.gold500} fg={colors.green900} />
          <View style={{ flex: 1 }}>
            <Text variant="displaySm" color={colors.white}>{user.displayName}</Text>
            <Text variant="bodySm" color={colors.green100}>{[user.student?.studentNumber, user.student?.programName].filter(Boolean).join(' · ')}</Text>
            {user.student?.advisorName ? <Text variant="caption" color={colors.green100}>Advisor: {user.student.advisorName}</Text> : null}
          </View>
        </Row>
        <Row style={{ marginTop: spacing.md }} wrap>
          <Pill label="Student" tone="gold" small />
          {user.student?.catalogYear ? <Pill label={`Catalog ${user.student.catalogYear}`} tone="grey" small /> : null}
        </Row>
      </Card>
      <DemoLabel text="Profile & services hub · inferred" style={{ marginVertical: spacing.md }} />
      <Stack>
        {groups.map(g => (
          <Card key={g} padding={spacing.md}>
            <Text variant="overline" style={{ marginBottom: 4 }}>{g}</Text>
            {menu.filter(m => m.group === g).map(m => (
              <ListRow key={m.key} icon={m.icon} title={m.label} subtitle={m.description} testID={`profile-${m.key}`} onPress={() => navigateTo(navigation, m.route, m.params)} right={m.inferred && mock ? <Icon name="FlaskConical" size={14} color={colors.gold600} /> : undefined} />
            ))}
          </Card>
        ))}
        {mock ? <Card padding={spacing.md}>
          <Text variant="overline" style={{ marginBottom: 4 }}>Developer</Text>
          <ListRow icon="Wrench" title="Developer gallery & scenarios" subtitle="QA shortcut · reset demo data" onPress={() => navigation.navigate(Routes.DevGallery)} testID="profile-devgallery" />
        </Card> : null}
        <Button title="Sign out" variant="outline" onPress={() => setConfirm(true)} testID="profile-logout" />
      </Stack>
      <ConfirmSheet visible={confirm} onClose={() => setConfirm(false)} onConfirm={() => { setConfirm(false); void logout(); }} title="Sign out?" message={mock ? 'Your session caches will be cleared. Saved demo records stay on this device.' : 'Your session caches will be cleared.'} confirmLabel="Sign out" icon="LogOut" testID="logout-sheet" />
    </Screen>
  );
}
