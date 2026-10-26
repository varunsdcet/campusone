import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, LoadingState, ErrorState, Icon, SegmentedTabs, KeyValue, BottomSheet } from '../../../components';
import { colors, spacing } from '../../../theme';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useSection, useSessions, useStudentSections } from './useCourses';
import { formatDate, parseISODate, toISODate, weekdayShort, monthLong } from '../../../utils/format';
import { clock, DAY_MS } from '../../../utils/clock';
import type { ClassSession } from '../../../domain/types';
import { useAppNavigation } from '../../../navigation/hooks';
import { useSettings } from '../../auth/useAuth';

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}${ampm}`;
}

/** Weekly + calendar views for one section (All Course Info) or for all sections (Schedule tab). */
export function ScheduleViews({ sessions, initialView = 'weekly', onOpenSession, anchor }: { sessions: (ClassSession & { label?: string; sectionCode?: string })[]; initialView?: 'weekly' | 'calendar'; onOpenSession: (s: ClassSession) => void; anchor?: Date }) {
  const [view, setView] = useState<'weekly' | 'calendar'>(initialView);
  const today = anchor ?? clock.nowDate();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string>(toISODate(today));
  const byDate = useMemo(() => {
    const map: Record<string, typeof sessions> = {};
    sessions.forEach(s => { (map[s.date] ??= []).push(s); });
    return map;
  }, [sessions]);
  const weekDays = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS));
  const monthCells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const lead = first.getDay();
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [month]);
  const selectedSessions = byDate[selected] ?? [];
  return (
    <Stack>
      <SegmentedTabs options={[{ value: 'weekly', label: 'Weekly view' }, { value: 'calendar', label: 'Calendar view' }]} value={view} onChange={setView} testID="schedule-view" />
      {view === 'weekly' ? (
        <>
          <Row justify="space-between">
            <Text variant="titleMd">Course schedule</Text>
            <Row gap={4}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous week" onPress={() => setWeekStart(w => new Date(w.getTime() - 7 * DAY_MS))} style={styles.navBtn} testID="week-prev"><Icon name="ChevronLeft" size={18} /></Pressable>
              <Text variant="caption">{formatDate(weekDays[0])} – {formatDate(weekDays[6])}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Next week" onPress={() => setWeekStart(w => new Date(w.getTime() + 7 * DAY_MS))} style={styles.navBtn} testID="week-next"><Icon name="ChevronRight" size={18} /></Pressable>
            </Row>
          </Row>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {weekDays.map(d => {
              const iso = toISODate(d);
              const list = byDate[iso] ?? [];
              const active = iso === selected;
              return (
                <Pressable key={iso} testID={`week-day-${iso}`} accessibilityRole="button" accessibilityLabel={`${weekdayShort(d)} ${d.getDate()}, ${list.length} sessions`} onPress={() => setSelected(iso)} style={[styles.dayCard, active ? styles.dayActive : null]}>
                  <Text variant="overline" color={active ? colors.green100 : undefined}>{weekdayShort(d).toUpperCase()}</Text>
                  <Text variant="titleMd" color={active ? colors.white : colors.ink}>{d.getDate()}</Text>
                  {list.length ? list.slice(0, 3).map(s => <Text key={s.id} variant="caption" color={active ? colors.white : colors.green900} numberOfLines={1}>{fmtTime(s.startTime)}</Text>) : <Text variant="caption" color={active ? colors.green100 : colors.inkFaint}>—</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
          <Text variant="caption">Swipe week →</Text>
        </>
      ) : (
        <>
          <Text variant="titleMd">Course calendar</Text>
          <Row justify="space-between">
            <Button title="← Prev" variant="ghost" size="sm" fullWidth={false} onPress={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} testID="month-prev" />
            <Text variant="titleSm">{monthLong(month)} {month.getFullYear()}</Text>
            <Button title="Next →" variant="ghost" size="sm" fullWidth={false} onPress={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} testID="month-next" />
          </Row>
          <View style={styles.grid}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <Text key={d} variant="overline" align="center" style={styles.cell}>{d}</Text>)}
            {monthCells.map((d, i) => {
              if (!d) return <View key={`e${i}`} style={styles.cell} />;
              const iso = toISODate(d);
              const list = byDate[iso] ?? [];
              const active = iso === selected;
              return (
                <Pressable key={iso} testID={`cal-day-${iso}`} accessibilityRole="button" accessibilityLabel={`${formatDate(d)}, ${list.length} sessions`} onPress={() => setSelected(iso)} style={[styles.cell, styles.dayCell, list.length ? styles.hasSession : null, active ? styles.cellActive : null]}>
                  <Text variant="label" color={active ? colors.white : colors.ink}>{d.getDate()}</Text>
                  {list.slice(0, 2).map(s => <View key={s.id} style={styles.chip}><Text variant="caption" style={{ fontSize: 9 }} color={colors.coral600} numberOfLines={1}>{fmtTime(s.startTime)}</Text></View>)}
                </Pressable>
              );
            })}
          </View>
        </>
      )}
      <Card padding={spacing.md}>
        <Text variant="overline" style={{ marginBottom: 4 }}>{formatDate(selected, { long: true })}</Text>
        {selectedSessions.length ? selectedSessions.map(s => (
          <Pressable key={s.id} accessibilityRole="button" onPress={() => onOpenSession(s)} style={styles.sessionRow} testID={`session-${s.id}`}>
            <View style={styles.timeBox}><Text variant="label" color={colors.green900}>{fmtTime(s.startTime)}</Text><Text variant="caption">{fmtTime(s.endTime)}</Text></View>
            <View style={{ flex: 1 }}><Text variant="bodyStrong">{s.topic}</Text>{s.label ? <Text variant="caption">{s.label}</Text> : null}</View>
            <Icon name="ChevronRight" size={16} color={colors.inkMuted} />
          </Pressable>
        )) : <Text variant="bodySm">No sessions on this day.</Text>}
      </Card>
    </Stack>
  );
}

export function CourseInfoScreen({ route }: RootScreenProps<'StudentCourseInfo'>) {
  const { sectionId } = route.params;
  const navigation = useAppNavigation();
  const section = useSection(sectionId);
  const sessions = useSessions(sectionId);
  const [detail, setDetail] = useState<ClassSession | null>(null);
  const s = section.data;
  return (
    <Screen testID="course-info" header={<ScreenHeader />}>
      {section.isLoading || sessions.isLoading ? <LoadingState /> : !s ? <ErrorState error={section.error} /> : (
        <Stack>
          <Text variant="displayMd" style={{ textTransform: 'uppercase' }}>{s.course.title}</Text>
          <Text variant="bodySm">{s.course.code} ({s.sectionCode})</Text>
          <Card padding={spacing.md}>
            <Stack gap={spacing.sm}>
              <KeyValue label="Course dates" value={`${formatDate(s.startDate, { long: true })} – ${formatDate(s.endDate, { long: true })}`} />
              <KeyValue label="Instructor(s)" value={s.instructorName.split(' ').reverse().join(', ')} />
              <KeyValue label="Location" value={`Campus: ${s.location}`} />
            </Stack>
          </Card>
          <ScheduleViews sessions={sessions.data ?? []} initialView={route.params.view ?? 'weekly'} anchor={parseISODate(s.startDate)} onOpenSession={setDetail} />
          <Button title="Open course details" variant="outline" onPress={() => navigation.navigate(Routes.StudentCourseDetails, { sectionId })} />
        </Stack>
      )}
      <SessionSheet session={detail} onClose={() => setDetail(null)} sectionLabel={s ? `${s.course.code} · ${s.course.title}` : ''} location={s?.location ?? ''} onOpenCourse={() => { setDetail(null); navigation.navigate(Routes.StudentCourseDetails, { sectionId }); }} />
    </Screen>
  );
}

export function SessionSheet({ session, onClose, sectionLabel, location, onOpenCourse }: { session: ClassSession | null; onClose: () => void; sectionLabel: string; location: string; onOpenCourse: () => void }) {
  return (
    <BottomSheet visible={!!session} onClose={onClose} title={session?.topic} subtitle={sectionLabel} testID="session-sheet">
      {session ? (
        <Stack gap={spacing.sm}>
          <KeyValue label="Date" value={formatDate(session.date, { long: true, weekday: true })} />
          <KeyValue label="Time" value={`${fmtTime(session.startTime)} – ${fmtTime(session.endTime)}`} />
          <KeyValue label="Location" value={location} />
          <Button title="Go to course" onPress={onOpenCourse} testID="session-open-course" />
        </Stack>
      ) : null}
    </BottomSheet>
  );
}

/** Student Schedule tab – every enrolled section's sessions in weekly/calendar views. */
export function StudentScheduleTabScreen() {
  const navigation = useAppNavigation();
  const sections = useStudentSections();
  const settings = useSettings();
  const all = useMemo(() => (sections.data ?? []).map(s => ({ section: s, q: s.id })), [sections.data]);
  return <ScheduleTabInner sectionIds={all.map(a => a.section.id)} labels={Object.fromEntries(all.map(a => [a.section.id, `${a.section.course.code} · ${a.section.location}`]))} loading={sections.isLoading} onOpenCourse={id => navigation.navigate(Routes.StudentCourseDetails, { sectionId: id })} tz={settings.data?.timeZone} />;
}

function ScheduleTabInner({ sectionIds, labels, loading, onOpenCourse, tz }: { sectionIds: string[]; labels: Record<string, string>; loading: boolean; onOpenCourse: (id: string) => void; tz?: string }) {
  const sessionsAll = useAllSessions(sectionIds);
  const [detail, setDetail] = useState<ClassSession | null>(null);
  const merged = useMemo(() => sessionsAll.flatMap(q => (q.data ?? []).map(s => ({ ...s, label: labels[s.sectionId] }))), [sessionsAll, labels]);
  return (
    <Screen testID="student-schedule" bottomInset={false}>
      <Text variant="displayLg" style={{ marginTop: spacing.sm }}>Schedule</Text>
      <Text variant="body" style={{ marginBottom: spacing.md }}>All enrolled course sessions{tz ? ` · shown in ${tz}` : ''}.</Text>
      {loading ? <LoadingState /> : <ScheduleViews sessions={merged} onOpenSession={setDetail} />}
      <SessionSheet session={detail} onClose={() => setDetail(null)} sectionLabel={detail ? labels[detail.sectionId] ?? '' : ''} location={detail ? labels[detail.sectionId]?.split(' · ')[1] ?? '' : ''} onOpenCourse={() => { if (detail) { onOpenCourse(detail.sectionId); setDetail(null); } }} />
    </Screen>
  );
}

import { useQueries } from '@tanstack/react-query';
import { useServices } from '../../../app/ServicesProvider';
import { qk } from '../../../app/queryKeys';
function useAllSessions(sectionIds: string[]) {
  const s = useServices();
  return useQueries({ queries: sectionIds.map(id => ({ queryKey: qk.sessions(id), queryFn: () => s.courses.listSessions(id) })) });
}

const styles = StyleSheet.create({
  navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  dayCard: { width: 84, minHeight: 110, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.sm, gap: 2 },
  dayActive: { backgroundColor: colors.green900, borderColor: colors.green900 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, minHeight: 28, paddingVertical: 2 },
  dayCell: { minHeight: 58, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: 'transparent', paddingTop: 4 },
  hasSession: { borderColor: colors.coral100, backgroundColor: colors.coral50 },
  cellActive: { backgroundColor: colors.green900 },
  chip: { backgroundColor: colors.gold100, borderRadius: 4, paddingHorizontal: 3, marginTop: 1, maxWidth: '95%' },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, minHeight: 48 },
  timeBox: { width: 64 },
});
