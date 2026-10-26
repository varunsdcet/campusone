import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, EmptyState, Icon, Input, Select, DateField, Avatar, ConfirmSheet, DemoLabel, InfoBanner } from '../../../components';
import { colors, spacing } from '../../../theme';
import type { RootScreenProps } from '../../../navigation/types';
import { useAttendanceForDate, useAttendanceMutations, useInstructorSections } from '../useInstructor';
import { useFileActions } from '../../shared/useFileActions';
import { toISODate, parseISODate, formatDate, weekdayShort } from '../../../utils/format';
import { clock, DAY_MS } from '../../../utils/clock';
import type { AttendanceStatus } from '../../../domain/types';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';
import { useUnsavedChangesGuard } from '../../shared/hooks';
import { useQueries } from '@tanstack/react-query';
import { useServices } from '../../../app/ServicesProvider';
import { qk } from '../../../app/queryKeys';

type Entry = { status?: AttendanceStatus; note?: string };

export function CourseAttendanceScreen({ route }: RootScreenProps<'InstructorCourseAttendance'>) {
  const sections = useInstructorSections();
  const files = useFileActions();
  const m = useAttendanceMutations();
  const [date, setDate] = useState(route.params?.date ?? toISODate(clock.nowDate()));
  const [studentFilter, setStudentFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState(route.params?.sectionId ?? 'all');
  const [loaded, setLoaded] = useState<{ date: string; sectionId?: string } | null>(null);
  const [week, setWeek] = useState(false);
  const [entries, setEntries] = useState<Record<string, Record<string, Entry>>>({});
  const [submitFor, setSubmitFor] = useState<string | null>(null);
  const data = useAttendanceForDate(loaded?.date ?? date, loaded?.sectionId);
  const dirty = Object.keys(entries).length > 0;
  const { allowLeave } = useUnsavedChangesGuard(dirty, 'Unsaved attendance changes will be lost.');
  useEffect(() => { setEntries({}); }, [loaded?.date, loaded?.sectionId]);
  const load = () => { setLoaded({ date, sectionId: courseFilter === 'all' ? undefined : courseFilter }); setEntries({}); };
  const shift = (days: number) => { const d = parseISODate(loaded?.date ?? date); const nd = toISODate(new Date(d.getTime() + days * DAY_MS)); setDate(nd); setLoaded({ date: nd, sectionId: loaded?.sectionId }); };
  const groups = useMemo(() => (data.data ?? []).map(g => ({ ...g, roster: g.roster.filter(u => !studentFilter.trim() || u.lastName.toLowerCase().includes(studentFilter.toLowerCase()) || u.student?.studentNumber.toLowerCase().includes(studentFilter.toLowerCase())) })), [data.data, studentFilter]);
  const entryFor = (sectionId: string, studentId: string): Entry => entries[sectionId]?.[studentId] ?? (() => { const r = data.data?.find(g => g.section.id === sectionId)?.records.find(x => x.studentId === studentId); return r ? { status: r.status, note: r.note } : {}; })();
  const setEntry = (sectionId: string, studentId: string, patch: Entry) => setEntries(e => ({ ...e, [sectionId]: { ...(e[sectionId] ?? {}), [studentId]: { ...entryFor(sectionId, studentId), ...patch } } }));
  const buildPayload = (sectionId: string) => { const g = data.data!.find(x => x.section.id === sectionId)!; return { sectionId, date: loaded!.date, entries: g.roster.map(u => ({ studentId: u.id, status: entryFor(sectionId, u.id).status!, note: entryFor(sectionId, u.id).note })).filter(e => e.status) }; };
  const saveDraft = async () => {
    try { for (const g of groups) { const p = buildPayload(g.section.id); if (p.entries.length) await m.saveDraft.mutateAsync(p); } setEntries({}); allowLeave(); toast('Drafts saved (not submitted)', 'success'); } catch (e) { toast(errorMessage(e), 'error'); }
  };
  const submit = async () => { if (!submitFor) return; try { await m.submit.mutateAsync(buildPayload(submitFor)); setEntries(e => { const n = { ...e }; delete n[submitFor]; return n; }); toast('Attendance submitted · summaries and student records refreshed', 'success'); } catch (e) { toast(errorMessage(e), 'error'); } setSubmitFor(null); };
  const printRoster = () => { const rows = groups.flatMap(g => g.roster.map(u => `"${g.section.course.code}","${u.lastName}, ${u.firstName}",${u.student?.studentNumber},${entryFor(g.section.id, u.id).status ?? ''}`)); void files.exportText(`attendance-roster-${loaded?.date ?? date}-DEMO.csv`, ['Course,Name,Student number,Status', ...rows].join('\n')); };
  const cancel = () => { setEntries({}); toast('Draft changes discarded', 'info'); };
  return (
    <Screen testID="course-attendance" header={<ScreenHeader backLabel="Courses" />} footer={loaded ? <Row><Button title="Cancel" variant="ghost" style={{ flex: 0.7 }} onPress={cancel} disabled={!dirty} testID="ca-cancel" /><Button title="Save Draft" variant="outline" style={{ flex: 1 }} onPress={saveDraft} loading={m.saveDraft.isPending} disabled={!dirty} disabledReason="No changes" testID="ca-save-draft" /><Button title="Submit Attendance" style={{ flex: 1.2 }} onPress={() => { const g = groups.find(x => x.roster.every(u => entryFor(x.section.id, u.id).status)); if (!g) { toast('Mark every student in a course before submitting', 'error'); return; } setSubmitFor(groups.length === 1 ? groups[0].section.id : g.section.id); }} disabled={!groups.length} testID="ca-submit" /></Row> : undefined}>
      <Stack>
        <Text variant="displayMd" style={{ textTransform: 'uppercase' }}>Course Attendance</Text>
        <Text variant="bodySm">Campus One • Faculty Records</Text>
        <Row><Button title={week ? 'Day View' : 'Week View'} variant="outline" size="sm" fullWidth={false} onPress={() => setWeek(w => !w)} testID="ca-week" /><Button title="Print Roster" variant="outline" size="sm" fullWidth={false} icon={<Icon name="Printer" size={14} color={colors.green900} />} onPress={printRoster} disabled={!loaded} testID="ca-print" /></Row>
        <Card padding={spacing.md}>
          <Stack gap={spacing.sm}>
            <DateField label="Date filter" value={date} onChange={setDate} testID="ca-date" />
            <Input label="Student filter" placeholder="Student # or last name" value={studentFilter} onChangeText={setStudentFilter} testID="ca-student" />
            <Select label="Course filter" value={courseFilter} onChange={setCourseFilter} options={[{ value: 'all', label: 'All Courses' }, ...(sections.data ?? []).map(s => ({ value: s.id, label: `${s.course.code} (${s.sectionCode})` }))]} testID="ca-course" />
            <Button title="Load Attendance" onPress={load} testID="ca-load" />
          </Stack>
        </Card>
        {loaded ? (
          <>
            <View style={styles.dateBar}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous day" onPress={() => shift(-1)} style={styles.navBtn} testID="ca-prev"><Icon name="ChevronLeft" size={18} color={colors.white} /><Text variant="caption" color={colors.white}>{formatDate(new Date(parseISODate(loaded.date).getTime() - DAY_MS))}</Text></Pressable>
              <Text variant="overline" color={colors.white} align="center" style={{ flex: 1 }}>Attendance for: {weekdayShort(parseISODate(loaded.date))}, {formatDate(loaded.date)}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Next day" onPress={() => shift(1)} style={styles.navBtn} testID="ca-next"><Text variant="caption" color={colors.white}>{formatDate(new Date(parseISODate(loaded.date).getTime() + DAY_MS))}</Text><Icon name="ChevronRight" size={18} color={colors.white} /></Pressable>
            </View>
            {week ? <WeekView date={loaded.date} sectionIds={(sections.data ?? []).filter(s => !loaded.sectionId || s.id === loaded.sectionId).map(s => s.id)} labels={Object.fromEntries((sections.data ?? []).map(s => [s.id, s.course.code]))} onPick={d => { setDate(d); setLoaded({ ...loaded, date: d }); setWeek(false); }} /> : null}
            {data.isLoading ? <LoadingState /> : data.error ? <ErrorState error={data.error} onRetry={() => data.refetch()} /> : !groups.length ? <EmptyState icon="CalendarX" title="No courses for this filter" /> : groups.map(g => {
              const submitted = g.records.some(r => r.state === 'submitted');
              const draft = g.records.some(r => r.state === 'draft');
              return (
                <Card key={g.section.id} testID={`ca-section-${g.section.id}`}>
                  <Row justify="space-between"><Text variant="displayXs" style={{ flex: 1 }}>{g.section.course.code} ({g.section.sectionCode}) — {g.section.course.title}</Text><Pill label={submitted ? 'Submitted' : draft ? 'Draft' : 'Continuous'} tone={submitted ? 'green' : draft ? 'yellow' : 'grey'} small /></Row>
                  {!g.session ? <InfoBanner tone="grey" icon="Info" text="No scheduled session on this date. Marking will create an ad-hoc session record." /> : null}
                  {!g.roster.length ? <Text variant="bodySm">No matching students.</Text> : g.roster.map(u => {
                    const e = entryFor(g.section.id, u.id);
                    return (
                      <View key={u.id} style={styles.student}>
                        <Row gap={spacing.sm}><Avatar initials={u.avatarInitials} size={34} bg={colors.green50} fg={colors.green900} /><View style={{ flex: 1 }}><Text variant="bodyStrong">{u.displayName}</Text><Text variant="caption">{u.student?.studentNumber}</Text></View></Row>
                        <Row style={{ marginTop: 6 }}>
                          {(['present', 'absent', 'late'] as AttendanceStatus[]).map(st => <Pressable key={st} testID={`ca-${g.section.id}-${u.id}-${st}`} accessibilityRole="radio" accessibilityState={{ selected: e.status === st }} onPress={() => setEntry(g.section.id, u.id, { status: st })} style={styles.radioRow}><View style={[styles.radio, e.status === st ? styles.radioOn : null]}>{e.status === st ? <View style={styles.radioDot} /> : null}</View><Text variant="bodySm">{st[0].toUpperCase() + st.slice(1)}</Text></Pressable>)}
                        </Row>
                        <Input placeholder="Note" value={e.note ?? ''} onChangeText={t => setEntry(g.section.id, u.id, { note: t })} containerStyle={{ marginTop: 6 }} testID={`ca-${g.section.id}-${u.id}-note`} />
                      </View>
                    );
                  })}
                  {groups.length > 1 ? <Button title={`Submit ${g.section.course.code}`} variant="outline" size="sm" style={{ marginTop: spacing.sm }} onPress={() => setSubmitFor(g.section.id)} disabled={!g.roster.every(u => entryFor(g.section.id, u.id).status)} disabledReason="Mark every student first" testID={`ca-submit-${g.section.id}`} /> : null}
                </Card>
              );
            })}
          </>
        ) : <Text variant="caption">Choose filters and tap Load Attendance.</Text>}
        <DemoLabel text="Cancel discards drafts · submit updates summaries and student records" />
      </Stack>
      <ConfirmSheet visible={!!submitFor} onClose={() => setSubmitFor(null)} onConfirm={submit} loading={m.submit.isPending} title="Submit attendance?" icon="ClipboardCheck" confirmLabel="Submit" message={`${groups.find(g => g.section.id === submitFor)?.section.course.code ?? ''} · ${formatDate(loaded?.date ?? date)}. Submitted attendance appears immediately in each student's record.`} testID="ca-submit-sheet" />
    </Screen>
  );
}

function WeekView({ date, sectionIds, labels, onPick }: { date: string; sectionIds: string[]; labels: Record<string, string>; onPick: (d: string) => void }) {
  const s = useServices();
  const queries = useQueries({ queries: sectionIds.map(id => ({ queryKey: qk.sessions(id), queryFn: () => s.courses.listSessions(id) })) });
  const d = parseISODate(date);
  const start = new Date(d); start.setDate(d.getDate() - d.getDay());
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY_MS));
  return (
    <Card padding={spacing.md}>
      <Text variant="overline" style={{ marginBottom: 4 }}>Week view</Text>
      <Row>{days.map(day => { const iso = toISODate(day); const list = queries.flatMap(q => (q.data ?? []).filter(x => x.date === iso)); const active = iso === date; return (
        <Pressable key={iso} accessibilityRole="button" accessibilityLabel={`${formatDate(day)}, ${list.length} sessions`} onPress={() => onPick(iso)} style={[styles.weekDay, active ? styles.weekDayActive : null]} testID={`ca-week-${iso}`}><Text variant="caption" color={active ? colors.white : undefined}>{weekdayShort(day)}</Text><Text variant="label" color={active ? colors.white : colors.ink}>{day.getDate()}</Text>{list.slice(0, 2).map(x => <Text key={x.id} variant="caption" color={active ? colors.green100 : colors.green900} style={{ fontSize: 9 }} numberOfLines={1}>{labels[x.sectionId]}</Text>)}</Pressable>
      ); })}</Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  dateBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.green900, borderRadius: 12, padding: spacing.sm },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, paddingHorizontal: 4 },
  student: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, flex: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.green900 },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green900 },
  weekDay: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8, minHeight: 56 },
  weekDayActive: { backgroundColor: colors.green900 },
});
