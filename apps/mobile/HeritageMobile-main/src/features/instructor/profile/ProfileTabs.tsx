import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Text, Card, Row, Stack, Button, Pill, Input, Select, LoadingState, ErrorState, EmptyState, Icon, KeyValueRow, DemoLabel, ListRow, InfoBanner, Toggle } from '../../../components';
import { colors, spacing } from '../../../theme';
import { Routes } from '../../../navigation/routes';
import { useInstructorSections } from '../useInstructor';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';
import type { AvailabilitySlot, InstructorProfile } from '../../../domain/types';
import type { InstructorProfileTabs } from '../../../services/contracts';
import { newId } from '../../../utils/ids';
import { useAppNavigation } from '../../../navigation/hooks';
import { useServices } from '../../../app/ServicesProvider';
import { qk } from '../../../app/queryKeys';
import { clock } from '../../../utils/clock';
import { formatDate, toISODate } from '../../../utils/format';
import { HtmlView } from '../../shared/HtmlView';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const EXPERTISE = ['Foundational', 'Intermediate', 'Advanced', 'Expert'] as const;
const DEMO_CERTIFICATIONS = ['Registered Social Worker (BCCSW) · demo', 'Trauma-Informed Practice Certificate · demo'];
const DEMO_DOCUMENTS = ['2026 Teaching contract (demo).pdf', 'Sessional rate schedule (demo).pdf'];

/** Live profile tab data (read-only; editing these tabs is done on the web portal). */
export function useProfileTabs(enabled: boolean) {
  const s = useServices();
  return useQuery({ queryKey: ['instructorProfileTabs'], queryFn: () => s.instructor.getProfileTabs!(), enabled: enabled && Boolean(s.instructor.getProfileTabs) });
}

const ChipList = ({ items, tone = 'green' }: { items: string[]; tone?: 'green' | 'grey' | 'teal' }) => <Row wrap>{items.map(t => <Pill key={t} label={t} tone={tone} />)}</Row>;
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <View style={{ marginTop: spacing.md }}><Text variant="overline" style={{ marginBottom: 6 }}>{title}</Text>{children}</View>;
const WebNote = () => <InfoBanner tone="grey" icon="Globe" text="Changes to this tab are made on the Campus One web portal." />;

/* ------------------------------ Topics ------------------------------ */

export function TopicsTab({ topics, onSave }: { topics: string[]; onSave: (t: string[]) => Promise<unknown> }) {
  const [list, setList] = useState(topics);
  const [draft, setDraft] = useState('');
  const [level, setLevel] = useState<(typeof EXPERTISE)[number]>('Advanced');
  return (
    <Stack>
      <Card>
        <Text variant="titleMd" style={{ marginBottom: spacing.sm }}>Teaching topics</Text>
        <Row wrap>{list.map(t => <Pressable key={t} accessibilityRole="button" accessibilityLabel={`Remove topic ${t}`} onPress={() => setList(l => l.filter(x => x !== t))}><Pill label={`${t} ×`} tone="green" /></Pressable>)}</Row>
        <Row style={{ marginTop: spacing.sm }}><View style={{ flex: 1 }}><Input placeholder="Add a topic" value={draft} onChangeText={setDraft} testID="topic-input" /></View><Button title="Add" fullWidth={false} onPress={() => { if (draft.trim()) { setList(l => [...l, draft.trim()]); setDraft(''); } }} testID="topic-add" /></Row>
        <Button title="Save topics" style={{ marginTop: spacing.sm }} onPress={async () => { try { await onSave(list); toast('Topics saved', 'success'); } catch (e) { toast(errorMessage(e), 'error'); } }} testID="topic-save" />
      </Card>
      <Card>
        <Text variant="titleMd" style={{ marginBottom: spacing.sm }}>Expertise level</Text>
        <Select label="Overall expertise" value={level} onChange={setLevel} options={EXPERTISE.map(l => ({ value: l, label: l }))} testID="topic-expertise" />
        <Text variant="titleMd" style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>Certifications</Text>
        {DEMO_CERTIFICATIONS.map(c => <Row key={c} gap={8} style={styles.line}><Icon name="BadgeCheck" size={16} color={colors.green700} /><Text variant="body" style={{ flex: 1 }}>{c}</Text></Row>)}
        <DemoLabel text="Demo · expertise level and certifications are not saved" style={{ marginTop: spacing.sm }} />
      </Card>
    </Stack>
  );
}

export function LiveTopicsTab({ data }: { data: InstructorProfileTabs['topics'] }) {
  const any = data.current.length + data.previous.length + data.chair.length;
  return (
    <Card testID="topics-live">
      <Text variant="titleMd">Teaching topics</Text>
      {!any ? <Text variant="bodySm" style={{ marginTop: 6 }}>No teaching topics on record yet.</Text> : null}
      {data.current.length ? <Section title="Current courses"><ChipList items={data.current} /></Section> : null}
      {data.previous.length ? <Section title="Previously taught"><ChipList items={data.previous} tone="grey" /></Section> : null}
      {data.chair.length ? <Section title="Academic chair topics"><ChipList items={data.chair} tone="teal" /></Section> : null}
      {data.research.length ? <Section title="Research"><ChipList items={data.research} tone="grey" /></Section> : null}
      {data.certifications.length ? <Section title="Certifications">{data.certifications.map(c => <Row key={c} gap={8} style={styles.line}><Icon name="BadgeCheck" size={16} color={colors.green700} /><Text variant="body" style={{ flex: 1 }}>{c}</Text></Row>)}</Section> : null}
      <View style={{ marginTop: spacing.md }}><WebNote /></View>
    </Card>
  );
}

/* ---------------------------- Availability ---------------------------- */

export function AvailabilityTab({ slots, onSave }: { slots: AvailabilitySlot[]; onSave: (a: AvailabilitySlot[]) => Promise<unknown> }) {
  const [list, setList] = useState(slots);
  const [day, setDay] = useState('Monday');
  const [from, setFrom] = useState('10:00');
  const [to, setTo] = useState('11:00');
  const [mode, setMode] = useState<AvailabilitySlot['mode']>('In person');
  const [virtualRoom, setVirtualRoom] = useState(true);
  const valid = /^\d{2}:\d{2}$/.test(from) && /^\d{2}:\d{2}$/.test(to) && from < to;
  const byDay = WEEKDAYS.map(d => ({ day: d, slots: list.filter(s => s.day === d).sort((a, b) => a.from.localeCompare(b.from)) }));
  return (
    <Stack>
      <Card>
        <Text variant="titleMd" style={{ marginBottom: spacing.sm }}>Weekly availability</Text>
        {byDay.map(({ day: d, slots: ds }) => (
          <View key={d} style={styles.slot} testID={`avail-row-${d}`}>
            <Row justify="space-between" align="flex-start">
              <Text variant="bodyStrong" style={{ width: 96 }}>{d}</Text>
              <View style={{ flex: 1 }}>
                {!ds.length ? <Text variant="bodySm">Unavailable</Text> : ds.map(s => <Row key={s.id} justify="space-between"><Text variant="body">{s.from} – {s.to}</Text><Row><Pill label={s.mode} tone="grey" small /><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${d} ${s.from} slot`} onPress={() => setList(l => l.filter(x => x.id !== s.id))} hitSlop={8}><Icon name="X" size={16} color={colors.danger600} /></Pressable></Row></Row>)}
              </View>
            </Row>
          </View>
        ))}
        <Select label="Day" value={day} onChange={setDay} options={WEEKDAYS.map(d => ({ value: d, label: d }))} testID="avail-day" />
        <Row style={{ marginTop: spacing.sm }}><View style={{ flex: 1 }}><Input label="From (HH:MM)" value={from} onChangeText={setFrom} testID="avail-from" /></View><View style={{ flex: 1 }}><Input label="To (HH:MM)" value={to} onChangeText={setTo} testID="avail-to" /></View></Row>
        <Select label="Mode" value={mode} onChange={setMode} options={[{ value: 'In person', label: 'In person' }, { value: 'Online', label: 'Online' }]} testID="avail-mode" />
        <Button title="Add slot" variant="outline" style={{ marginTop: spacing.sm }} disabled={!valid} disabledReason="Use HH:MM and ensure From is before To" onPress={() => setList(l => [...l, { id: newId('av'), day, from, to, mode }])} testID="avail-add" />
        <Button title="Save availability" style={{ marginTop: spacing.sm }} onPress={async () => { try { await onSave(list); toast('Availability saved', 'success'); } catch (e) { toast(errorMessage(e), 'error'); } }} testID="avail-save" />
      </Card>
      <Card>
        <Text variant="titleMd" style={{ marginBottom: spacing.sm }}>Office hours</Text>
        {list.length ? list.map(s => <Text key={s.id} variant="body">{s.day} · {s.from}–{s.to} · {s.mode}</Text>) : <Text variant="bodySm">No office hours published.</Text>}
        <View style={{ marginTop: spacing.sm }}><Toggle label="Virtual office-hours room" value={virtualRoom} onChange={setVirtualRoom} testID="avail-virtual-room" /></View>
        <DemoLabel text="Demo · virtual room toggle is session-only" />
      </Card>
    </Stack>
  );
}

export function LiveAvailabilityTab({ data }: { data: InstructorProfileTabs['availability'] }) {
  return (
    <Stack>
      <Card testID="availability-live">
        <Text variant="titleMd" style={{ marginBottom: spacing.sm }}>Availability</Text>
        {!data.slots.length ? <Text variant="bodySm">No availability windows published yet.</Text> : data.slots.map(s => (
          <Row key={s.id} justify="space-between" align="flex-start" style={styles.slot}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{s.day}</Text>
              <Text variant="body">{s.from} – {s.to}{s.location ? ` · ${s.location}` : ''}</Text>
              {s.date ? <Text variant="caption">{s.endDate && s.endDate !== s.date ? `${formatDate(s.date)} – ${formatDate(s.endDate)}` : formatDate(s.date)}</Text> : null}
              {s.note ? <Text variant="caption">{s.note}</Text> : null}
            </View>
            <Pill label={s.mode} tone={/office/i.test(s.mode) ? 'teal' : 'grey'} small />
          </Row>
        ))}
      </Card>
      {data.officeHours ? <Card><Text variant="titleMd" style={{ marginBottom: spacing.sm }}>Office hours</Text>{data.officeHours.split('\n').map(l => <Text key={l} variant="body">{l}</Text>)}</Card> : null}
      {data.generalInfo.trim() ? <Card><Text variant="overline" style={{ marginBottom: 4 }}>General information</Text><HtmlView html={data.generalInfo} /></Card> : null}
      <WebNote />
    </Stack>
  );
}

/* ---------------------------- Compensation ---------------------------- */

export function CompensationTab({ compensation }: { compensation: InstructorProfile['compensation'] }) {
  return (
    <Card testID="compensation-demo">
      <DemoLabel text="Demo · synthetic compensation values" style={{ marginBottom: spacing.sm }} />
      <KeyValueRow label="Band" value={compensation.rateLabel} />
      <KeyValueRow label="Rate type" value={compensation.basis} />
      <KeyValueRow label="Pay period" value="Semi-monthly (demo)" />
      <KeyValueRow label="Note" value={compensation.note} border={false} />
      <Section title="Documents">{DEMO_DOCUMENTS.map(d => <ListRow key={d} icon="FileText" title={d} onPress={() => toast('Demo document · no file attached', 'info')} />)}</Section>
      <InfoBanner tone="grey" icon="Lock" text="Real compensation data comes from HR systems and is intentionally not modelled in demo mode." />
    </Card>
  );
}

export function LiveCompensationTab({ data }: { data: InstructorProfileTabs['compensation'] }) {
  if (!data.summary.length && !data.payPeriods.length && !data.contracts.length) {
    return <Card testID="compensation-live"><EmptyState contained={false} icon="Lock" title="No compensation records" message="Compensation details have not been published to your Campus One profile. Contact HR for rate and pay-period information." /></Card>;
  }
  const rowText = (r: Record<string, string>) => Object.values(r).filter(Boolean).join(' · ');
  return (
    <Card testID="compensation-live">
      {data.summary.map((s, i) => <KeyValueRow key={`${s.label}-${i}`} label={s.label} value={s.value} border={i < data.summary.length - 1} />)}
      {data.payPeriods.length ? <Section title="Pay periods">{data.payPeriods.map((p, i) => <Text key={i} variant="body" style={styles.line}>{rowText(p)}</Text>)}</Section> : null}
      {data.contracts.length ? <Section title="Documents">{data.contracts.map((c, i) => <Text key={i} variant="body" style={styles.line}>{rowText(c)}</Text>)}</Section> : null}
    </Card>
  );
}

/* ------------------------------ Schedule ------------------------------ */

function SectionsCard() {
  const navigation = useAppNavigation();
  const sections = useInstructorSections();
  return (
    <Card>
      <Text variant="titleMd" style={{ marginBottom: spacing.sm }}>Teaching sections</Text>
      {sections.isLoading ? <LoadingState /> : sections.error ? <ErrorState error={sections.error} onRetry={() => sections.refetch()} /> : (sections.data ?? []).map(s => <ListRow key={s.id} icon="Calendar" title={`${s.course.code} (${s.sectionCode})`} subtitle={`${s.scheduleLabel} · ${s.location}`} onPress={() => navigation.navigate(Routes.InstructorCourseWorkspace, { sectionId: s.id })} />)}
      <Button title="Pending schedule changes" variant="outline" style={{ marginTop: spacing.sm }} onPress={() => navigation.navigate(Routes.InstructorPendingSchedules)} />
    </Card>
  );
}

type WeekDay = { label: string; dateLabel?: string; entries: { key: string; title: string; time: string; location?: string; kind?: 'class' | 'availability' }[] };

function WeekCard({ title, days }: { title: string; days: WeekDay[] }) {
  return (
    <Card testID="schedule-week">
      <Text variant="titleMd">Week view</Text>
      {title ? <Text variant="caption" style={{ marginBottom: spacing.sm }}>{title}</Text> : null}
      {days.map(d => (
        <Row key={d.label} align="flex-start" style={styles.slot}>
          <View style={{ width: 84 }}><Text variant="bodyStrong">{d.label.slice(0, 3)}</Text>{d.dateLabel ? <Text variant="caption">{d.dateLabel}</Text> : null}</View>
          <View style={{ flex: 1 }}>
            {!d.entries.length ? <Text variant="bodySm">—</Text> : d.entries.map(e => (
              <View key={e.key} style={{ marginBottom: 4 }}>
                <Row gap={6}><Text variant="bodyStrong" style={{ flex: 1 }}>{e.title}</Text>{e.kind === 'availability' ? <Pill label="Availability" tone="teal" small /> : null}</Row>
                <Text variant="caption">{e.time}{e.location ? ` · ${e.location}` : ''}</Text>
              </View>
            ))}
          </View>
        </Row>
      ))}
    </Card>
  );
}

const UpcomingCard = ({ items }: { items: { key: string; title: string; subtitle: string }[] }) => (
  <Card testID="schedule-upcoming">
    <Text variant="titleMd" style={{ marginBottom: spacing.sm }}>Upcoming sessions</Text>
    {!items.length ? <Text variant="bodySm">No upcoming sessions scheduled.</Text> : items.map(i => <ListRow key={i.key} icon="Clock" title={i.title} subtitle={i.subtitle} />)}
  </Card>
);

const hm = (t: string) => { const [h = 0, m = 0] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`; };

export function ScheduleTab() {
  const s = useServices();
  const sections = useInstructorSections();
  const list = useMemo(() => sections.data ?? [], [sections.data]);
  const sessions = useQueries({ queries: list.map(x => ({ queryKey: qk.sessions(x.id), queryFn: () => s.courses.listSessions(x.id) })) });
  const days: WeekDay[] = WEEKDAYS.map((label, i) => ({
    label,
    entries: list.filter(x => x.meetingDays.includes(i + 1)).map(x => ({ key: x.id, title: `${x.course.code} (${x.sectionCode})`, time: `${hm(x.startTime)} – ${hm(x.endTime)}`, location: x.location, kind: 'class' as const })),
  }));
  const today = toISODate(new Date(clock.now()));
  const upcoming = sessions
    .flatMap((q, i) => (q.data ?? []).map(se => ({ se, sec: list[i] })))
    .filter(({ se }) => se.date >= today)
    .sort((a, b) => `${a.se.date}${a.se.startTime}`.localeCompare(`${b.se.date}${b.se.startTime}`))
    .slice(0, 6)
    .map(({ se, sec }) => ({ key: se.id, title: `${sec?.course.code ?? ''} · ${se.topic}`, subtitle: `${formatDate(se.date)} · ${hm(se.startTime)} – ${hm(se.endTime)}` }));
  return (
    <Stack>
      {sections.isLoading ? <LoadingState /> : <WeekCard title="Recurring weekly pattern" days={days} />}
      <UpcomingCard items={upcoming} />
      <SectionsCard />
    </Stack>
  );
}

export function LiveScheduleTab({ data }: { data: InstructorProfileTabs['schedule'] }) {
  const days: WeekDay[] = data.days.map(d => ({ label: d.label, dateLabel: d.dateLabel, entries: d.entries.map((e, i) => ({ key: `${d.label}-${i}`, title: e.title, time: e.time, location: e.location, kind: e.kind })) }));
  return (
    <Stack>
      {days.length ? <WeekCard title={data.weekLabel} days={days} /> : null}
      <UpcomingCard items={data.upcoming.map((u, i) => ({ key: `${u.date}-${u.section}-${i}`, title: `${u.course} (${u.section})`, subtitle: `${formatDate(u.date)} · ${u.time}` }))} />
      <SectionsCard />
    </Stack>
  );
}

const styles = StyleSheet.create({
  slot: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  line: { paddingVertical: 4 },
});
