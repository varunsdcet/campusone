import React, { useState } from 'react';
import { View } from 'react-native';
import { Card, Text, Row, Stack, Button, ListRow, Pill, StatTile, ConfirmSheet, EmptyState, type PillTone } from '../../components';
import { spacing } from '../../theme';
import { useAppNavigation, navigateTo } from '../../navigation/hooks';
import { Routes } from '../../navigation/routes';
import type { ApplicantPortalAction, ApplicantPortalView } from '../../services/contracts/applicant';
import { toast } from '../../state/uiStore';
import { errorMessage } from '../../services/errors';
import { applicantTarget, useApplicantMutations } from './useApplicant';

export function statusTone(s: string | undefined): PillTone {
  const v = (s ?? '').toLowerCase();
  if (/accepted|uploaded|submitted|done|complete|ready|read\b|offered/.test(v)) return 'green';
  if (/missing|todo|rejected|declined|withdrawn|unread/.test(v)) return 'coral';
  if (/pending|review|interview|draft|progress/.test(v)) return 'gold';
  return 'grey';
}

export function statusLabel(s: string | undefined): string {
  const v = (s ?? '').replace(/_/g, ' ').replace(/\s+application$/i, '').trim();
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : '—';
}

const CONFIRM: Record<string, { title: string; message: string; confirmLabel: string; destructive?: boolean; icon?: 'Send' | 'CircleCheck' | 'CircleX' | 'CalendarCheck' }> = {
  submit_application: { title: 'Submit application?', message: 'Once submitted, your application can no longer be edited. Admissions will review your packet.', confirmLabel: 'Submit', icon: 'Send' },
  accept_offer: { title: 'Accept this offer?', message: 'Admissions will be notified that you accept the offer and its conditions.', confirmLabel: 'Accept offer', icon: 'CircleCheck' },
  decline_offer: { title: 'Decline this offer?', message: 'Admissions will be notified that you decline. This cannot be undone in the app.', confirmLabel: 'Decline offer', destructive: true, icon: 'CircleX' },
  ready_interview: { title: 'Ready for interview?', message: 'Admissions will be told you are ready to schedule your interview.', confirmLabel: 'Confirm', icon: 'CalendarCheck' },
};

const DONE: Record<string, string> = {
  submit_application: 'Application submitted. Admissions will be in touch.',
  accept_offer: 'Offer accepted.',
  decline_offer: 'Offer declined.',
  ready_interview: 'Admissions has been told you are ready for interview.',
  save_progress: 'Progress saved.',
};

/** Renders a server-built applicant portal page: metrics, row sections and actions. */
export function PortalViewContent({ view, path, hideSections, emptyTitle }: { view: ApplicantPortalView; path: string; hideSections?: string[]; emptyTitle?: string }) {
  const navigation = useAppNavigation();
  const m = useApplicantMutations();
  const [confirm, setConfirm] = useState<ApplicantPortalAction | null>(null);

  const open = (href: string | undefined) => {
    const t = applicantTarget(href);
    if (t) navigateTo(navigation, t.route, t.params);
  };

  const run = async (a: ApplicantPortalAction) => {
    try {
      await m.action.mutateAsync({ action: a.action!, payload: a.payload, path });
      toast(DONE[a.action!] ?? 'Done.', 'success');
      setConfirm(null);
    } catch (e) {
      setConfirm(null);
      toast(errorMessage(e), 'error');
    }
  };

  const press = (a: ApplicantPortalAction) => {
    if (a.action === 'upload_document') return navigateTo(navigation, Routes.ApplicantTabs, { screen: Routes.ApplicantDocumentsTab });
    if (a.action) return CONFIRM[a.action] ? setConfirm(a) : void run(a);
    open(a.href);
  };

  const sections = view.sections.filter(s => !hideSections?.includes(s.title));
  const actions = view.actions.filter(a => a.action || applicantTarget(a.href));
  const c = confirm?.action ? CONFIRM[confirm.action] : undefined;
  return (
    <Stack>
      {view.metrics.length ? (
        <Row align="stretch">
          {view.metrics.slice(0, 3).map(mt => <StatTile key={mt.label} label={mt.label} value={/status/i.test(mt.label) ? statusLabel(String(mt.value)) : mt.value} sub={mt.hint} style={{ flex: 1 }} />)}
        </Row>
      ) : null}
      {sections.map(s => (
        <Card key={s.title} padding={spacing.md}>
          <Text variant="overline" style={{ marginBottom: 4 }}>{s.title}</Text>
          {s.rows.length ? s.rows.map((r, i) => {
            const target = applicantTarget(r.href);
            return (
              <ListRow
                key={`${r.primary}-${i}`}
                title={r.primary}
                subtitle={r.secondary}
                right={r.meta ? <Pill label={r.meta} tone={statusTone(r.meta)} small /> : undefined}
                onPress={target ? () => navigateTo(navigation, target.route, target.params) : undefined}
                testID={`applicant-row-${i}`}
              />
            );
          }) : <EmptyState icon="Inbox" title={emptyTitle ?? 'Nothing here yet'} />}
        </Card>
      ))}
      {actions.length ? (
        <View style={{ gap: spacing.sm }}>
          {actions.map(a => (
            <Button
              key={a.label}
              title={a.label}
              variant={a.action === 'decline_offer' ? 'outline' : a.variant === 'primary' ? 'primary' : a.variant === 'ai' ? 'gold' : 'outline'}
              loading={m.action.isPending && m.action.variables?.action === a.action && !!a.action}
              disabled={m.action.isPending}
              onPress={() => press(a)}
              testID={`applicant-action-${a.action ?? a.href}`}
            />
          ))}
        </View>
      ) : null}
      <ConfirmSheet
        visible={!!confirm && !!c}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && void run(confirm)}
        title={c?.title ?? ''}
        message={c?.message ?? ''}
        confirmLabel={c?.confirmLabel}
        destructive={c?.destructive}
        icon={c?.icon}
        loading={m.action.isPending}
        testID="applicant-confirm"
      />
    </Stack>
  );
}
