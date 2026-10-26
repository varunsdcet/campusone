import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, Icon, ProgressBar, DemoLabel } from '../../../components';
import { colors, spacing } from '../../../theme';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useEnrolments, useProgramme } from './useCatalogue';
import { useSnapshot, useCertificate } from '../learning/useLearning';
import { formatDate } from '../../../utils/format';

/** Inferred supporting screen: self-paced enrolments and certificates. */
export function MyLearningScreen({ navigation }: RootScreenProps<'StudentMyLearning'>) {
  const enrolments = useEnrolments();
  return (
    <Screen header={<ScreenHeader title="My Learning" />} testID="my-learning">
      <Stack>
        <DemoLabel text="Inferred supporting screen" />
        {enrolments.isLoading ? <LoadingState /> : enrolments.error ? <ErrorState error={enrolments.error} onRetry={() => enrolments.refetch()} /> : !enrolments.data?.length ? (
          <Card tone="green" style={styles.discovery} testID="mylearning-empty">
            <Stack gap={spacing.md}>
              <View style={styles.discoveryIcon}><Icon name="GraduationCap" size={26} color={colors.green900} /></View>
              <View style={styles.discoveryCopy}>
                <Text variant="overline" color={colors.success600}>Learn at your pace</Text>
                <Text variant="titleLg">Start your first programme</Text>
                <Text variant="bodySm">Choose a self-paced programme, track every activity and unlock your certificate after completion.</Text>
              </View>
              <Stack gap={spacing.sm}>
                <Row gap={spacing.sm}><Icon name="Clock" size={17} color={colors.success600} /><Text variant="bodySm">Continue whenever your schedule allows</Text></Row>
                <Row gap={spacing.sm}><Icon name="CircleCheck" size={17} color={colors.success600} /><Text variant="bodySm">Progress syncs automatically</Text></Row>
                <Row gap={spacing.sm}><Icon name="Award" size={17} color={colors.success600} /><Text variant="bodySm">Certificate unlocks on completion</Text></Row>
              </Stack>
              <Button title="Browse Current Programs →" onPress={() => navigation.navigate(Routes.StudentCatalogue)} testID="mylearning-empty-catalogue" />
            </Stack>
          </Card>
        ) : <>{enrolments.data.map(e => <EnrolmentCard key={e.id} programmeId={e.programmeId} enrolledAt={e.enrolledAt} onOpen={() => navigation.navigate(Routes.StudentOutline, { programmeId: e.programmeId })} onCertificate={() => navigation.navigate(Routes.StudentCertificate, { programmeId: e.programmeId })} />)}<Button title="Browse Current Programs" variant="outline" onPress={() => navigation.navigate(Routes.StudentCatalogue)} testID="mylearning-catalogue" /></>}
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  discovery: { overflow: 'hidden' },
  discoveryIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.success100, alignItems: 'center', justifyContent: 'center' },
  discoveryCopy: { gap: spacing.xs },
  enrolmentAction: { flex: 1, minWidth: 0 },
});

function EnrolmentCard({ programmeId, enrolledAt, onOpen, onCertificate }: { programmeId: string; enrolledAt: string; onOpen: () => void; onCertificate: () => void }) {
  const programme = useProgramme(programmeId);
  const snap = useSnapshot(programmeId);
  const cert = useCertificate(programmeId);
  return (
    <Card testID={`enrolment-${programmeId}`}>
      <Stack gap={spacing.sm}>
        <Row justify="space-between"><Pill label={snap.data?.completedAll ? 'Completed' : 'In progress'} tone={snap.data?.completedAll ? 'green' : 'coral'} small dot /><Text variant="caption">Enrolled {formatDate(enrolledAt)}</Text></Row>
        <Text variant="titleMd">{programme.data?.title ?? '…'}</Text>
        <ProgressBar value={snap.data?.percent ?? 0} color={colors.gold500} />
        <Text variant="bodySm">{snap.data ? `${snap.data.completedCount}/${snap.data.totalCount} activities · ${snap.data.chapterUnlockedCount} of ${programme.data?.chapterCount ?? '—'} chapters unlocked` : 'Loading progress…'}</Text>
        <Row>
          <Button title="Open outline" onPress={onOpen} style={styles.enrolmentAction} testID={`enrolment-open-${programmeId}`} />
          <Button title={cert.data ? 'Certificate' : 'Certificate preview'} variant="outline" onPress={onCertificate} style={styles.enrolmentAction} testID={`enrolment-cert-${programmeId}`} />
        </Row>
      </Stack>
    </Card>
  );
}
