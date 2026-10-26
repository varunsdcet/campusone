import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { Screen, ScreenHeader, Text, Button, Card, Select, Row, Stack, DemoLabel, ConfirmSheet, Pill, ListRow } from '../components';
import { Routes, RouteName } from '../navigation/routes';
import { rootStackRoutes } from '../navigation/screens';
import { scenario } from '../services/mock/simulate';
import { useRepository, useServices } from '../app/ServicesProvider';
import { useSessionStore } from '../state/sessionStore';
import { clock, DAY_MS } from '../utils/clock';
import { toast } from '../state/uiStore';
import { useLogout } from '../features/auth/useAuth';
import { DEMO_PASSWORD, IDS } from '../fixtures/constants';
import { formatDateTime } from '../utils/format';
import { progressionPolicy } from '../config/progressionPolicy';
import { useClockTick } from '../features/shared/hooks';
import { spacing } from '../theme';

type Mode = 'success' | 'slow' | 'error' | 'permissionDenied' | 'empty';

/**
 * Developer gallery & scenario controls. A QA shortcut only – every screen is
 * also reachable through the app's real navigation.
 */
export function DevGalleryScreen() {
  const navigation = useNavigation();
  const repo = useRepository();
  const services = useServices();
  const qc = useQueryClient();
  const user = useSessionStore(s => s.user);
  const setSignedIn = useSessionStore(s => s.setSignedIn);
  const logout = useLogout();
  const [mode, setMode] = useState<Mode>(scenario.get().mode);
  const [filter, setFilter] = useState<string>(scenario.get().methodFilter ?? '');
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const now = useClockTick(1000);

  const applyScenario = (m: Mode) => {
    setMode(m);
    scenario.set({ mode: m, methodFilter: filter || undefined, oneShot: true });
    toast(`Scenario: ${m}${filter ? ` (${filter}*)` : ''} — applies to the next matching call`, 'info');
  };
  const switchRole = async (role: 'student' | 'instructor') => {
    const loginId = role === 'student' ? 'ST-2024-001' : 'monica.dahiya@heritage.edu';
    await logout();
    const r = await services.auth.login({ loginId, password: DEMO_PASSWORD, rememberMe: true });
    setSignedIn(r.session, r.user);
  };
  const doReset = async () => {
    setResetting(true);
    await repo.resetToSeed();
    qc.clear();
    clock.setOffsetMs(new Date('2026-09-25T15:44:17-07:00').getTime() - Date.now());
    setResetting(false);
    setResetOpen(false);
    toast('Demo data reset to seed', 'success');
  };
  const jumpDays = (d: number) => {
    clock.advance(d * DAY_MS);
    qc.invalidateQueries();
    toast(`Demo clock moved ${d > 0 ? 'forward' : 'back'} ${Math.abs(d)} day(s)`, 'info');
  };
  const jumpToLearning = async (activityIndex: number) => {
    if (!user || user.role !== 'student') { toast('Sign in as the student first', 'error'); return; }
    const p = repo.find('programmes', IDS.programmeOffice)!;
    const acts = p.chapters.flatMap(c => c.activities);
    const target = acts[Math.min(activityIndex, acts.length - 1)];
    await services.learning.devJumpTo(user.id, IDS.programmeOffice, target.id);
    qc.invalidateQueries();
    toast(`Progress set to: ${target.title}`, 'success');
  };

  const screens = rootStackRoutes.filter(r => r !== Routes.DevGallery && r !== Routes.Forbidden);
  const studentScreens = screens.filter(r => r.startsWith('Student'));
  const instructorScreens = screens.filter(r => r.startsWith('Instructor'));
  const sharedScreens = screens.filter(r => !r.startsWith('Student') && !r.startsWith('Instructor'));

  return (
    <Screen header={<ScreenHeader title="Developer gallery" subtitle="QA shortcut · not app navigation" />} testID="dev-gallery">
      <Stack>
        <DemoLabel text="Developer-only controls" />
        <Card>
          <Stack gap={spacing.sm}>
            <Text variant="titleSm">Session</Text>
            <Text variant="bodySm">{user ? `${user.displayName} · ${user.role}` : 'Signed out'}</Text>
            <Row>
              <Button title="Student" size="sm" variant={user?.role === 'student' ? 'primary' : 'outline'} onPress={() => switchRole('student')} testID="dev-role-student" />
              <Button title="Instructor" size="sm" variant={user?.role === 'instructor' ? 'primary' : 'outline'} onPress={() => switchRole('instructor')} testID="dev-role-instructor" />
              {user ? <Button title="Sign out" size="sm" variant="ghost" onPress={() => logout()} testID="dev-logout" /> : null}
            </Row>
          </Stack>
        </Card>
        <Card>
          <Stack gap={spacing.sm}>
            <Text variant="titleSm">Service scenario (deterministic)</Text>
            <Text variant="caption">Applies to the next matching mock call, then resets so Retry succeeds. Leave the filter empty to affect any method.</Text>
            <Select label="Mode" value={mode} onChange={applyScenario} testID="dev-scenario-mode" options={[
              { value: 'success', label: 'Success' },
              { value: 'slow', label: 'Slow response (4s)' },
              { value: 'error', label: 'Retryable server error' },
              { value: 'permissionDenied', label: 'Permission denied' },
              { value: 'empty', label: 'Empty results (persistent until changed)' },
            ]} />
            <Select label="Method filter" value={filter} onChange={v => { setFilter(v); scenario.set({ methodFilter: v || undefined }); }} testID="dev-scenario-filter" options={[
              { value: '', label: 'Any method' }, { value: 'courses.', label: 'courses.*' }, { value: 'assignments.', label: 'assignments.*' }, { value: 'notifications.', label: 'notifications.*' }, { value: 'workshops.', label: 'workshops.*' }, { value: 'catalogue.', label: 'catalogue.*' }, { value: 'instructor.', label: 'instructor.*' }, { value: 'mail.', label: 'mail.*' }, { value: 'coach.', label: 'coach.*' }, { value: 'askHeritage.', label: 'askHeritage.*' },
            ]} />
            <Pill label={`Current: ${scenario.get().mode}`} tone={scenario.get().mode === 'success' ? 'green' : 'coral'} />
          </Stack>
        </Card>
        <Card>
          <Stack gap={spacing.sm}>
            <Text variant="titleSm">Demo clock</Text>
            <Text variant="bodySm">Now: {formatDateTime(new Date(now))}</Text>
            <Text variant="caption">Chapters release every {24 / progressionPolicy.chapterReleasePerDay}h after enrolment; jump the clock to test the full learning journey without waiting.</Text>
            <Row>
              <Button title="+1 day" size="sm" variant="outline" onPress={() => jumpDays(1)} testID="dev-clock-plus1" />
              <Button title="+7 days" size="sm" variant="outline" onPress={() => jumpDays(7)} testID="dev-clock-plus7" />
              <Button title="−1 day" size="sm" variant="outline" onPress={() => jumpDays(-1)} />
            </Row>
            <Row wrap>
              <Button title="Learning: start" size="sm" variant="subtle" onPress={() => jumpToLearning(0)} testID="dev-learn-start" />
              <Button title="Chapter 1 assessment" size="sm" variant="subtle" onPress={() => jumpToLearning(5)} testID="dev-learn-ch1-assess" />
              <Button title="Chapter 12" size="sm" variant="subtle" onPress={() => jumpToLearning(64)} testID="dev-learn-ch12" />
              <Button title="Final activity" size="sm" variant="subtle" onPress={() => jumpToLearning(69)} testID="dev-learn-final" />
            </Row>
          </Stack>
        </Card>
        <Card>
          <Stack gap={spacing.sm}>
            <Text variant="titleSm">Demo data</Text>
            <Button title="Reset Demo Data…" variant="danger" onPress={() => setResetOpen(true)} testID="dev-reset" />
          </Stack>
        </Card>
        {user ? (
          <>
            <GallerySection title={`Student screens (${studentScreens.length})`} routes={studentScreens} onOpen={r => navigation.navigate(r as never)} />
            <GallerySection title={`Instructor screens (${instructorScreens.length})`} routes={instructorScreens} onOpen={r => navigation.navigate(r as never)} />
            <GallerySection title={`Shared screens (${sharedScreens.length})`} routes={sharedScreens} onOpen={r => navigation.navigate(r as never)} />
          </>
        ) : <Text variant="bodySm">Sign in to open screens from the gallery.</Text>}
      </Stack>
      <ConfirmSheet visible={resetOpen} onClose={() => setResetOpen(false)} onConfirm={doReset} loading={resetting} destructive title="Reset demo data?" message="All saved demo changes (progress, submissions, requests, messages) will be discarded and the seed fixtures restored. Your session stays signed in." confirmLabel="Reset demo data" testID="dev-reset-sheet" />
    </Screen>
  );
}

function GallerySection({ title, routes, onOpen }: { title: string; routes: RouteName[]; onOpen: (r: RouteName) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Card padding={spacing.md}>
      <Button title={`${open ? 'Hide' : 'Show'} ${title}`} variant="subtle" size="sm" onPress={() => setOpen(o => !o)} />
      {open ? <View style={{ marginTop: spacing.sm }}>{routes.map(r => <ListRow key={r} title={r} onPress={() => onOpen(r)} testID={`gallery-${r}`} />)}</View> : null}
    </Card>
  );
}
