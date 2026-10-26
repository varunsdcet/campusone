import React, { useState } from 'react';
import { View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, ListRow, Pill, Avatar, ConfirmSheet, LoadingState, ErrorState, EmptyState, InfoBanner, SegmentedTabs } from '../../components';
import { colors, spacing } from '../../theme';
import { useCurrentUser } from '../../state/sessionStore';
import { Routes } from '../../navigation/routes';
import type { ApplicantTabProps, RootScreenProps } from '../../navigation/types';
import { useAppNavigation, navigateTo } from '../../navigation/hooks';
import { useLogout } from '../auth/useAuth';
import { PortalViewContent } from './PortalViewContent';
import { useApplicantHome, useApplicantService, useApplicantView } from './useApplicant';

/** Shown in demo (mock) mode, where there is no admissions backend. */
export function ApplicantUnavailable() {
  return <EmptyState icon="CloudOff" title="Applicant portal unavailable" message="The applicant portal needs a live Campus One connection." testID="applicant-unavailable" />;
}

function PortalPage({ path, title, testID, hideSections, emptyTitle, intro }: { path: string; title: string; testID: string; hideSections?: string[]; emptyTitle?: string; intro?: React.ReactNode }) {
  const svc = useApplicantService();
  const view = useApplicantView(path);
  return (
    <Screen testID={testID} header={<ScreenHeader title={view.data?.title ?? title} subtitle={view.data?.subtitle} />} refreshing={view.isRefetching} onRefresh={() => view.refetch()}>
      {!svc ? <ApplicantUnavailable /> : view.isLoading ? <LoadingState /> : view.error ? <ErrorState error={view.error} onRetry={() => view.refetch()} /> : view.data ? (
        <Stack>
          {intro}
          <PortalViewContent view={view.data} path={path} hideSections={hideSections} emptyTitle={emptyTitle} />
        </Stack>
      ) : null}
    </Screen>
  );
}

export function ApplicantHomeScreen(_props: ApplicantTabProps<'ApplicantHomeTab'>) {
  const user = useCurrentUser();
  const svc = useApplicantService();
  const home = useApplicantHome();
  return (
    <Screen testID="applicant-home" bottomInset={false} refreshing={home.isRefetching} onRefresh={() => home.refetch()}>
      <Card tone="dark" style={{ marginTop: spacing.sm }}>
        <Row gap={spacing.md}>
          <Avatar initials={user.avatarInitials} size={52} bg={colors.gold500} fg={colors.green900} />
          <View style={{ flex: 1 }}>
            <Text variant="overline" color={colors.green100}>Welcome to Campus One</Text>
            <Text variant="displaySm" color={colors.white}>{user.firstName || user.displayName}</Text>
            {home.data?.subtitle ? <Text variant="bodySm" color={colors.green100}>{home.data.subtitle}</Text> : null}
          </View>
        </Row>
        <Row style={{ marginTop: spacing.md }}><Pill label="Applicant" tone="gold" small /></Row>
      </Card>
      <View style={{ marginTop: spacing.md }}>
        {!svc ? <ApplicantUnavailable /> : home.isLoading ? <LoadingState /> : home.error ? <ErrorState error={home.error} onRetry={() => home.refetch()} /> : home.data ? (
          <PortalViewContent view={home.data} path="/applicant" emptyTitle="No timeline events yet" />
        ) : null}
      </View>
    </Screen>
  );
}

export function ApplicantOffersScreen(_props: RootScreenProps<'ApplicantOffers'>) {
  return <PortalPage path="/applicant/offers" title="Offers" testID="applicant-offers" intro={<InfoBanner tone="gold" icon="Info" text="Offers are issued by Admissions staff. Review the conditions before you accept or decline." />} />;
}

export function ApplicantTimelineScreen(_props: RootScreenProps<'ApplicantTimeline'>) {
  return <PortalPage path="/applicant/timeline" title="Timeline" testID="applicant-timeline" emptyTitle="No timeline events yet" />;
}

export function ApplicantViewScreen({ route }: RootScreenProps<'ApplicantView'>) {
  return <PortalPage path={route.params.path} title={route.params.title ?? 'Applicant'} testID="applicant-view" />;
}

type InboxTab = 'messages' | 'notifications';

export function ApplicantMessagesScreen({ route }: ApplicantTabProps<'ApplicantMessagesTab'>) {
  const [tab, setTab] = useState<InboxTab>(route.params?.tab ?? 'messages');
  const [seen, setSeen] = useState(route.params?.tab);
  if (route.params?.tab !== seen) {
    setSeen(route.params?.tab);
    if (route.params?.tab) setTab(route.params.tab);
  }
  const svc = useApplicantService();
  const path = tab === 'messages' ? '/applicant/messages' : '/applicant/notifications';
  const view = useApplicantView(path);
  return (
    <Screen testID="applicant-messages" bottomInset={false} header={<ScreenHeader title="Messages" hideBack />} refreshing={view.isRefetching} onRefresh={() => view.refetch()}>
      <Stack>
        <SegmentedTabs options={[{ value: 'messages', label: 'Admissions' }, { value: 'notifications', label: 'Notifications' }]} value={tab} onChange={setTab} testID="applicant-inbox-tabs" />
        {!svc ? <ApplicantUnavailable /> : view.isLoading ? <LoadingState /> : view.error ? <ErrorState error={view.error} onRetry={() => view.refetch()} /> : view.data ? (
          <>
            {view.data.sections.map(s => (
              <Card key={s.title} padding={spacing.md}>
                <Text variant="overline" style={{ marginBottom: 4 }}>{s.title}</Text>
                {s.rows.length ? s.rows.map((r, i) => (
                  <View key={`${r.primary}-${i}`} style={{ paddingVertical: spacing.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, gap: 2 }} testID={`applicant-${tab}-${i}`}>
                    <Row justify="space-between" align="flex-start">
                      <Text variant="bodyStrong" style={{ flex: 1 }}>{r.primary}</Text>
                      {r.meta && /unread/i.test(r.meta) ? <Pill label="Unread" tone="coral" small /> : null}
                    </Row>
                    {r.secondary ? <Text variant="body">{r.secondary}</Text> : null}
                    {r.meta ? <Text variant="caption">{r.meta.replace(/^(Read|Unread) · /, '')}</Text> : null}
                  </View>
                )) : <EmptyState icon="Inbox" title="Nothing here yet" />}
              </Card>
            ))}
            {tab === 'messages' ? <InfoBanner tone="grey" icon="Info" text="Messages from Admissions appear here. Replying isn't available in the app yet — use Ask Campus One for questions about your application." /> : null}
          </>
        ) : null}
      </Stack>
    </Screen>
  );
}

export function ApplicantMoreScreen(_props: ApplicantTabProps<'ApplicantMoreTab'>) {
  const user = useCurrentUser();
  const navigation = useAppNavigation();
  const logout = useLogout();
  const [confirm, setConfirm] = useState(false);
  const items = [
    { key: 'offers', label: 'Offers', description: 'Review, accept or decline', icon: 'Award' as const, go: () => navigation.navigate(Routes.ApplicantOffers) },
    { key: 'timeline', label: 'Timeline', description: 'Every step of your application', icon: 'History' as const, go: () => navigation.navigate(Routes.ApplicantTimeline) },
    { key: 'interview', label: 'Interview', description: 'Interview status & readiness', icon: 'CalendarCheck' as const, go: () => navigation.navigate(Routes.ApplicantView, { path: '/applicant/interview', title: 'Interview' }) },
    { key: 'notifications', label: 'Notifications', description: 'Status and offer alerts', icon: 'Bell' as const, go: () => navigateTo(navigation, Routes.ApplicantTabs, { screen: Routes.ApplicantMessagesTab, params: { tab: 'notifications' } }) },
    { key: 'ask', label: 'Ask Campus One', description: 'Questions about your application', icon: 'Sparkles' as const, go: () => navigation.navigate(Routes.AskHeritage) },
    { key: 'security', label: 'Security Settings', description: 'Change your password', icon: 'ShieldCheck' as const, go: () => navigation.navigate(Routes.StudentSecurity, { next: 'changePassword' }) },
  ];
  return (
    <Screen testID="applicant-more" bottomInset={false}>
      <Card tone="dark" style={{ marginTop: spacing.sm }}>
        <Row gap={spacing.md}><Avatar initials={user.avatarInitials} size={52} bg={colors.gold500} fg={colors.green900} /><View style={{ flex: 1 }}><Text variant="displaySm" color={colors.white}>{user.displayName}</Text>{user.email ? <Text variant="bodySm" color={colors.green100}>{user.email}</Text> : null}</View></Row>
        <Row style={{ marginTop: spacing.md }}><Pill label="Applicant" tone="gold" small /></Row>
      </Card>
      <Stack style={{ marginTop: spacing.md }}>
        <Card padding={spacing.md}>
          {items.map(i => <ListRow key={i.key} icon={i.icon} title={i.label} subtitle={i.description} onPress={i.go} testID={`applicant-more-${i.key}`} />)}
        </Card>
        <Button title="Sign out" variant="outline" onPress={() => setConfirm(true)} testID="applicant-logout" />
      </Stack>
      <ConfirmSheet visible={confirm} onClose={() => setConfirm(false)} onConfirm={() => { setConfirm(false); void logout(); }} title="Sign out?" message="You can sign back in any time to continue your application." confirmLabel="Sign out" icon="LogOut" testID="applicant-logout-sheet" />
    </Screen>
  );
}
