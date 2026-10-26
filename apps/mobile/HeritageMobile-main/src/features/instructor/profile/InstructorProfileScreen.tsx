import React, { useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, Input, Select, LoadingState, ErrorState, Icon, ChipRow, BottomSheet, KeyValueRow, DemoLabel, StatTile, ProgressBar, ListRow, InfoBanner, Avatar } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useInstructorProfile } from '../useInstructor';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';
import type { FacultyRecord } from '../../../domain/types';
import { useAppNavigation } from '../../../navigation/hooks';
import { AvailabilityTab, CompensationTab, LiveAvailabilityTab, LiveCompensationTab, LiveScheduleTab, LiveTopicsTab, ScheduleTab, TopicsTab, useProfileTabs } from './ProfileTabs';

type Tab = 'biography' | 'topics' | 'availability' | 'compensation' | 'schedule' | 'accomplishments';
const TABS: { value: Tab; label: string }[] = [{ value: 'biography', label: 'Biography' }, { value: 'topics', label: 'Topics' }, { value: 'availability', label: 'Availability' }, { value: 'compensation', label: 'Compensation' }, { value: 'schedule', label: 'Schedule' }, { value: 'accomplishments', label: 'Accomplishments' }];

export function InstructorProfileScreen({ route }: RootScreenProps<'InstructorProfile'>) {
  const navigation = useAppNavigation();
  const { profile, update } = useInstructorProfile();
  const [tab, setTab] = useState<Tab>(route.params?.tab ?? 'biography');
  const [actions, setActions] = useState(false);
  const [editInfo, setEditInfo] = useState<'teacher' | 'other' | null>(null);
  const [imageSheet, setImageSheet] = useState(false);
  const mock = isMockMode();
  const liveTabs = useProfileTabs(!mock && tab !== 'biography' && tab !== 'accomplishments');
  const u = profile.data;
  const inst = u?.instructor;
  const [form, setForm] = useState<Record<string, string>>({});
  const openEdit = (which: 'teacher' | 'other') => {
    if (!u || !inst) return;
    setForm(which === 'teacher' ? { displayName: u.displayName, email: u.email, phone: inst.phone ?? '', preferredName: u.preferredName ?? '', pronouns: inst.pronouns ?? '', office: inst.office ?? '', department: inst.department } : { rank: inst.rank, highestDegree: inst.highestDegree ?? '', yearsTeaching: inst.yearsTeaching ? String(inst.yearsTeaching) : '', hireDate: inst.hireDate ?? '' });
    setEditInfo(which);
  };
  const saveInfo = async () => {
    try {
      if (editInfo === 'teacher') await update.mutateAsync({ displayName: form.displayName, email: form.email, phone: form.phone, preferredName: form.preferredName, pronouns: form.pronouns, office: form.office, department: form.department });
      else await update.mutateAsync({ rank: form.rank, highestDegree: form.highestDegree, yearsTeaching: form.yearsTeaching ? Number(form.yearsTeaching) : undefined, hireDate: form.hireDate });
      toast('Profile updated', 'success'); setEditInfo(null);
    } catch (e) { toast(errorMessage(e), 'error'); }
  };
  return (
    <Screen testID="instructor-profile" header={<ScreenHeader backLabel="Back" actions={[{ label: 'Actions ▾', accessibilityLabel: 'Actions menu', onPress: () => setActions(true), testID: 'profile-actions' }, { label: 'Update', accessibilityLabel: 'Update profile', variant: 'primary', onPress: () => openEdit('teacher'), testID: 'profile-update' }]} />}>
      {profile.isLoading ? <LoadingState /> : !u || !inst ? <ErrorState error={profile.error} /> : (
        <Stack>
          <Card>
            <Row gap={spacing.md}>
              <Pressable accessibilityRole="button" accessibilityLabel="Edit profile image" onPress={() => setImageSheet(true)} testID="profile-image"><Avatar initials={u.avatarInitials} size={56} bg={colors.green50} fg={colors.green900} /><View style={styles.pencil}><Icon name="Pencil" size={12} color={colors.white} /></View></Pressable>
              <View style={{ flex: 1 }}><Text variant="titleLg">{u.displayName}</Text><Text variant="bodySm">Instructor</Text></View>
              <Pill label="Active" tone="teal" small dot />
            </Row>
          </Card>
          <ChipRow options={TABS} value={tab} onChange={setTab} testID="profile-tab" />
          {tab === 'biography' ? (<>
            <Card>
              <Row justify="space-between" style={{ marginBottom: spacing.sm }}><Text variant="titleMd">Teacher Information</Text><Pressable accessibilityRole="button" accessibilityLabel="Edit teacher information" onPress={() => openEdit('teacher')} style={styles.editBtn} testID="profile-edit-teacher"><Icon name="Pencil" size={18} color={colors.green900} /></Pressable></Row>
              <KeyValueRow label="Staff ID" value={inst.staffId} /><KeyValueRow label="Full name" value={u.displayName} /><KeyValueRow label="Email" value={u.email} /><KeyValueRow label="Phone" value={inst.phone ?? '—'} /><KeyValueRow label="Preferred name" value={u.preferredName ?? '—'} /><KeyValueRow label="Pronouns" value={inst.pronouns ?? '—'} /><KeyValueRow label="Office" value={inst.office ?? '—'} /><KeyValueRow label="Department" value={inst.department} border={false} />
            </Card>
            <Card>
              <Row justify="space-between" style={{ marginBottom: spacing.sm }}><Text variant="titleMd">Other Information</Text><Pressable accessibilityRole="button" accessibilityLabel="Edit other information" onPress={() => openEdit('other')} style={styles.editBtn} testID="profile-edit-other"><Icon name="Pencil" size={18} color={colors.green900} /></Pressable></Row>
              <KeyValueRow label="Faculty rank" value={inst.rank} /><KeyValueRow label="Highest degree" value={inst.highestDegree ?? '—'} /><KeyValueRow label="Years teaching" value={inst.yearsTeaching ? String(inst.yearsTeaching) : '—'} /><KeyValueRow label="Hire date" value={inst.hireDate ?? '—'} border={false} />
            </Card>
            <Card><Text variant="overline" style={{ marginBottom: 4 }}>Biography</Text><Text variant="body">{inst.biography ?? 'No biography yet.'}</Text></Card>
          </>) : tab === 'accomplishments' ? <AccomplishmentsTab /> : mock ? (
            tab === 'topics' ? <TopicsTab topics={inst.topics} onSave={t => update.mutateAsync({ topics: t })} /> : tab === 'availability' ? <AvailabilityTab slots={inst.availability} onSave={a => update.mutateAsync({ availability: a })} /> : tab === 'compensation' ? <CompensationTab compensation={inst.compensation} /> : <ScheduleTab />
          ) : liveTabs.isLoading ? <LoadingState /> : !liveTabs.data ? <ErrorState error={liveTabs.error} onRetry={() => liveTabs.refetch()} /> : (
            tab === 'topics' ? <LiveTopicsTab data={liveTabs.data.topics} /> : tab === 'availability' ? <LiveAvailabilityTab data={liveTabs.data.availability} /> : tab === 'compensation' ? <LiveCompensationTab data={liveTabs.data.compensation} /> : <LiveScheduleTab data={liveTabs.data.schedule} />
          )}
          {mock ? <DemoLabel text="Synthetic staff record" /> : null}
        </Stack>
      )}
      <BottomSheet visible={actions} onClose={() => setActions(false)} title="Actions" testID="profile-actions-sheet">
        <ListRow icon="Mail" title="Campus mail" onPress={() => { setActions(false); navigation.navigate(Routes.Mail); }} />
        <ListRow icon="Globe" title="Change your time zone" onPress={() => { setActions(false); navigation.navigate(Routes.TimeZone); }} />
        <ListRow icon="Award" title="Accomplishments" onPress={() => { setActions(false); setTab('accomplishments'); }} />
        {isMockMode() ? <ListRow icon="Wrench" title="Developer gallery" onPress={() => { setActions(false); navigation.navigate(Routes.DevGallery); }} /> : null}
      </BottomSheet>
      <BottomSheet visible={!!editInfo} onClose={() => setEditInfo(null)} title={editInfo === 'teacher' ? 'Edit teacher information' : 'Edit other information'} testID="profile-edit-sheet">
        {Object.keys(form).map(k => <Input key={k} label={k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())} value={form[k]} onChangeText={t => setForm(f => ({ ...f, [k]: t }))} keyboardType={k === 'yearsTeaching' ? 'number-pad' : 'default'} testID={`profile-field-${k}`} />)}
        <Button title="Save" onPress={saveInfo} loading={update.isPending} testID="profile-save" />
      </BottomSheet>
      <BottomSheet visible={imageSheet} onClose={() => setImageSheet(false)} title="Profile image" testID="profile-image-sheet">
        <InfoBanner tone="grey" icon="Image" text="Photo upload needs a backend media endpoint (proposed in API_HANDOFF). Choose initials style instead." />
        <Row>{[['green', colors.green50, colors.green900], ['gold', colors.gold500, colors.green900], ['dark', colors.green900, colors.white]].map(([k, bg, fg]) => <Pressable key={k} accessibilityRole="button" accessibilityLabel={`${k} avatar style`} onPress={() => { toast(isMockMode() ? 'Avatar style applied for this session (demo)' : 'Avatar style applied for this session', 'success'); setImageSheet(false); }}><Avatar initials={u?.avatarInitials ?? ''} size={56} bg={bg} fg={fg} /></Pressable>)}</Row>
      </BottomSheet>
    </Screen>
  );
}

function AccomplishmentsTab() {
  const navigation = useAppNavigation();
  const { accomplishments, createBase, addRecord, updateRecord } = useInstructorProfile();
  const [baseOpen, setBaseOpen] = useState(false);
  const [base, setBase] = useState({ name: '', description: '', checkVersion: '1.0', language: 'English (EN-US)', issuer: 'Campus One', skillLevel: 'Instructor' });
  const [recordOpen, setRecordOpen] = useState<Partial<FacultyRecord> | null>(null);
  const a = accomplishments.data;
  const iconFor: Record<FacultyRecord['icon'], React.ComponentProps<typeof Icon>['name']> = { note: 'NotebookPen', award: 'Star', curriculum: 'Workflow', teaching: 'BookMarked', history: 'FolderOpen' };
  if (accomplishments.isLoading || !a) return <LoadingState />;
  return (
    <Stack>
      <Row gap={6}><View style={styles.bar} /><Text variant="overline" color={colors.green900}>My accomplishments & badges</Text></Row>
      <Row><Button title="Create Base" icon={<Icon name="CirclePlus" size={16} color={colors.white} />} style={{ flex: 1.3 }} onPress={() => setBaseOpen(true)} testID="acc-create-base" /><Button title="+ Add Record" variant="subtle" style={{ flex: 1 }} onPress={() => setRecordOpen({ icon: 'note', year: '2026' })} testID="acc-add-record" /></Row>
      <Row><StatTile label="Current sections" value={a.currentSections} icon="Rows3" sub={<ProgressBar value={70} color={colors.coral500} height={4} />} /><StatTile label="Courses taught" value={a.coursesTaught} icon="GraduationCap" sub={<ProgressBar value={100} color={colors.green700} height={4} />} /></Row>
      <Row><StatTile label="Students" value={a.students} icon="Users" sub={<ProgressBar value={30} color={colors.green700} height={4} />} /><StatTile label="Badge bases" value={a.badgeBases.length} icon="BadgeCheck" sub={<ProgressBar value={50} color={colors.coral500} height={4} />} /></Row>
      <Card padding={spacing.md}><Row gap={spacing.md}><View style={styles.tile}><Icon name="Award" size={20} color={colors.green900} /></View><View style={{ flex: 1 }}><Text variant="bodyStrong">Badges issued to scholars</Text><Text variant="caption">{isMockMode() ? 'Local demo records · not blockchain or verified credentials' : 'Issued by Heritage instructors'}</Text></View><Text variant="displayMd">{a.issuedCount}</Text></Row></Card>
      <Row justify="space-between"><Row gap={6}><Text variant="overline">Create base</Text><Pill label="Template" tone="green" small /></Row><Pressable accessibilityRole="button" onPress={() => setBaseOpen(true)}><Text variant="label" color={colors.green900}>Full badge form ↗</Text></Pressable></Row>
      {a.badgeBases.map(b => (
        <Card key={b.id} testID={`base-${b.id}`}>
          <Row gap={spacing.md}><View style={styles.tile}><Icon name="Terminal" size={18} color={colors.green900} /></View><View style={{ flex: 1 }}><Row gap={6}><Text variant="titleSm">{b.name}</Text><Pill label={b.status} tone="green" small dot /></Row><Text variant="caption">{b.description}</Text></View></Row>
          <View style={styles.grid}><KeyValueRow label="Check version" value={b.checkVersion} border={false} /><KeyValueRow label="Language" value={b.language} border={false} /><KeyValueRow label="Issuer" value={b.issuer} border={false} /><KeyValueRow label="Skill level" value={b.skillLevel} border={false} /></View>
          <Row justify="space-between" style={{ marginTop: spacing.sm }}><Row gap={6}><Icon name="Bot" size={14} color={colors.inkMuted} /><Text variant="caption">{isMockMode() ? 'Automated generation flow (demo)' : 'Automated generation flow'}</Text></Row><Pressable accessibilityRole="button" accessibilityLabel="More options" onPress={() => toast(isMockMode() ? 'Badge base options: edit/disable (demo)' : 'Badge base options: edit/disable', 'info')} style={styles.more}><Icon name="Ellipsis" size={16} /></Pressable></Row>
        </Card>
      ))}
      <Row justify="space-between"><Row gap={6}><Text variant="overline">Faculty record</Text><Pill label={`${a.records.length} Entries`} tone="green" small /></Row>{isMockMode() ? <Text variant="caption">Local demo records</Text> : null}</Row>
      {a.records.map(r => (
        <Card key={r.id} padding={spacing.md} onPress={r.id.startsWith('derived') ? () => navigation.navigate(Routes.InstructorCourseHistory) : () => setRecordOpen(r)} testID={`record-${r.id}`}>
          <Row gap={spacing.md} align="flex-start"><View style={[styles.tile, r.icon === 'award' ? { backgroundColor: colors.coral100 } : null]}><Icon name={iconFor[r.icon]} size={18} color={r.icon === 'award' ? colors.coral600 : colors.green900} /></View><View style={{ flex: 1 }}><Text variant="titleSm">{r.title}</Text><Text variant="bodySm" numberOfLines={3}>{r.description}</Text></View><Pill label={r.year} tone="green" small /></Row>
        </Card>
      ))}
      <Row justify="space-between"><Row gap={6}><Text variant="overline">Student badges issued</Text><Pill label={`${a.studentBadges.length} Issued`} tone="green" small /></Row><Icon name="ShieldCheck" size={16} color={colors.green700} /></Row>
      {a.studentBadges.map(b => <Card key={`${b.badgeCode}-${b.studentName}`} padding={spacing.md}><Row gap={spacing.md}><View style={[styles.tile, { borderRadius: 24, backgroundColor: b.status === 'earned' ? colors.teal100 : colors.surfaceMuted }]}><Icon name={b.status === 'earned' ? 'Hash' : 'Lightbulb'} size={18} color={colors.green900} /></View><View style={{ flex: 1 }}><Text variant="titleSm">{b.title}</Text><Text variant="bodySm">{b.studentName} • <Text variant="label" color={colors.green900}>{b.badgeCode}</Text></Text><Pill label={b.status} tone={b.status === 'earned' ? 'green' : 'grey'} small style={{ marginTop: 4 }} /></View><Pill label={b.year ?? '—'} tone="green" small /></Row></Card>)}
      <BottomSheet visible={baseOpen} onClose={() => setBaseOpen(false)} title="Create badge base" subtitle="Local template · no credential issuance" testID="base-sheet">
        {(Object.keys(base) as (keyof typeof base)[]).map(k => <Input key={k} label={k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())} value={base[k]} onChangeText={t => setBase(b => ({ ...b, [k]: t }))} testID={`base-${k}`} />)}
        <Button title="Create base" onPress={async () => { try { await createBase.mutateAsync(base); toast('Badge base created', 'success'); setBaseOpen(false); } catch (e) { toast(errorMessage(e), 'error'); } }} loading={createBase.isPending} disabled={!base.name.trim()} disabledReason="Name is required" testID="base-save" />
      </BottomSheet>
      <BottomSheet visible={!!recordOpen} onClose={() => setRecordOpen(null)} title={recordOpen?.id ? 'Edit record' : 'Add record'} testID="record-sheet">
        <Input label="Title" required value={recordOpen?.title ?? ''} onChangeText={t => setRecordOpen(r => ({ ...r, title: t }))} testID="record-title" />
        <Input label="Description" multiline value={recordOpen?.description ?? ''} onChangeText={t => setRecordOpen(r => ({ ...r, description: t }))} testID="record-desc" />
        <Input label="Year" value={recordOpen?.year ?? ''} onChangeText={t => setRecordOpen(r => ({ ...r, year: t }))} keyboardType="number-pad" testID="record-year" />
        <Select label="Icon" value={recordOpen?.icon ?? 'note'} onChange={v => setRecordOpen(r => ({ ...r, icon: v as FacultyRecord['icon'] }))} options={[{ value: 'note', label: 'Note' }, { value: 'award', label: 'Award' }, { value: 'curriculum', label: 'Curriculum' }]} testID="record-icon" />
        <Button title="Save record" onPress={async () => { if (!recordOpen) return; try { if (recordOpen.id) await updateRecord.mutateAsync({ id: recordOpen.id, patch: recordOpen }); else await addRecord.mutateAsync({ title: recordOpen.title ?? '', description: recordOpen.description ?? '', year: recordOpen.year ?? '2026', icon: recordOpen.icon ?? 'note' }); toast('Record saved', 'success'); setRecordOpen(null); } catch (e) { toast(errorMessage(e), 'error'); } }} loading={addRecord.isPending || updateRecord.isPending} disabled={!recordOpen?.title?.trim()} disabledReason="Title is required" testID="record-save" />
      </BottomSheet>
    </Stack>
  );
}

const styles = StyleSheet.create({
  pencil: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.green900, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  editBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.green50, alignItems: 'center', justifyContent: 'center' },
  slot: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  bar: { width: 4, height: 16, borderRadius: 2, backgroundColor: colors.coral500 },
  tile: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.green50, alignItems: 'center', justifyContent: 'center' },
  grid: { backgroundColor: colors.green50, borderRadius: 10, paddingHorizontal: spacing.sm, marginTop: spacing.sm },
  more: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
});
