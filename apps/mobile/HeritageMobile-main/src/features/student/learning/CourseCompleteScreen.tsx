import React from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, Icon, StatTile, DemoLabel, Avatar } from '../../../components';
import { colors, spacing } from '../../../theme';
import { appConfig, isMockMode } from '../../../config/appConfig';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useProgramme } from '../catalogue/useCatalogue';
import { useSnapshot, useCertificate, useLearningMutations } from './useLearning';
import { useCurrentUser } from '../../../state/sessionStore';
import { formatDate } from '../../../utils/format';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';

export function CourseCompleteScreen({ navigation, route }: RootScreenProps<'StudentCourseComplete'>) {
  const { programmeId } = route.params;
  const user = useCurrentUser();
  const programme = useProgramme(programmeId);
  const snap = useSnapshot(programmeId);
  const cert = useCertificate(programmeId);
  const mock = isMockMode();
  const m = useLearningMutations(programmeId);
  const p = programme.data;
  const s = snap.data;
  const issue = async () => {
    try {
      await m.issueCertificate.mutateAsync();
      toast(mock ? 'Demo certificate issued' : 'Certificate issued', 'success');
      navigation.navigate(Routes.StudentCertificate, { programmeId });
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  return (
    <Screen testID="course-complete" header={<ScreenHeader title="Course Complete" subtitle="Campus One" actions={[{ icon: 'Share2', accessibilityLabel: 'Share', onPress: () => Share.share({ message: mock ? `I completed ${p?.title ?? 'a programme'} in the Heritage demo app.` : `I completed ${p?.title ?? 'a programme'} at Campus One.${cert.data && appConfig.webOrigin ? ` ${appConfig.webOrigin}/verify/${encodeURIComponent(cert.data.id)}` : ''}` }) }]} leftSlot={<Avatar initials={user.avatarInitials} size={32} />} />}>
      {programme.isLoading || snap.isLoading ? <LoadingState /> : !p || !s ? <ErrorState error={programme.error ?? snap.error} /> : !s.completedAll ? (
        <Stack>
          <Card tone="gold">
            <Row gap={8}><Icon name="Lock" size={20} color={colors.gold600} /><Text variant="titleSm">Not complete yet</Text></Row>
            <Text variant="bodySm">{s.completedCount} of {s.totalCount} activities done · {s.chaptersPassed} of {p.chapterCount} chapter assessments passed. Completion and the certificate are derived from the same progress records.</Text>
          </Card>
          <Button title="Back to outline" onPress={() => navigation.navigate(Routes.StudentOutline, { programmeId })} />
        </Stack>
      ) : (
        <Stack>
          <View style={styles.center}>
            <Pill label="Academic milestone • 100% completed" tone="gold" small />
            <View style={styles.badge}><Icon name="GraduationCap" size={40} color={colors.green900} /><View style={styles.seal}><Icon name="Check" size={14} color={colors.white} strokeWidth={3} /></View></View>
            <Text variant="displayLg" align="center">Congratulations, {user.firstName}!</Text>
            <Pill label={p.title} tone="green" />
            <Text variant="body" align="center">{mock ? 'You have completed every chapter, activity, and chapter assessment in this demo programme. This is a demo milestone, not an official credential.' : 'You have completed every chapter, activity, and chapter assessment in this programme.'}</Text>
          </View>
          <Card>
            <Row justify="space-between" style={{ marginBottom: spacing.sm }}><Text variant="overline">Program summary</Text><Pill label={mock ? 'Completed (demo)' : 'Completed'} tone="green" small /></Row>
            <Row><StatTile label="Course completion" value="100%" /><StatTile label="Chapters completed" value={p.chapterCount} /></Row>
            <Row style={{ marginTop: spacing.sm }}><StatTile label="Activities finished" value={s.totalCount} /><StatTile label="Hours credited" value={p.hours.toFixed(1)} /></Row>
          </Card>
          <Card>
            <Row justify="space-between" style={{ marginBottom: spacing.sm }}><Text variant="overline">Certificate of completion</Text><Pill label={cert.data ? (mock ? 'Issued (demo)' : 'Issued') : 'Ready to issue'} tone={cert.data ? 'green' : 'gold'} small /></Row>
            <View style={styles.mini}>
              <Text variant="overline" align="center" color={colors.green900}>Campus One</Text>
              {mock ? <Text variant="caption" align="center" color={colors.gold600}>DEMO / NOT AN OFFICIAL CREDENTIAL</Text> : null}
              <Text variant="displaySm" align="center" style={{ marginTop: 6 }}>{user.displayName}</Text>
              <Text variant="bodySm" align="center">{p.title}</Text>
              <Row justify="space-between" style={{ marginTop: spacing.sm }}><Text variant="caption">{mock ? 'Demo signature' : 'Authorised signature'}</Text><Text variant="caption">{formatDate(cert.data?.issuedAt ?? s.progress.completedAt ?? new Date())}</Text></Row>
            </View>
            {cert.data ? (
              <Button title={mock ? 'View & Download Certificate →' : 'View Certificate →'} variant="coral" onPress={() => navigation.navigate(Routes.StudentCertificate, { programmeId })} style={{ marginTop: spacing.md }} testID="complete-view-cert" />
            ) : (
              <Button title={mock ? 'Issue demo certificate →' : 'Issue certificate →'} variant="coral" onPress={issue} loading={m.issueCertificate.isPending} style={{ marginTop: spacing.md }} testID="complete-issue-cert" />
            )}
            <Text variant="caption" align="center" style={{ marginTop: spacing.sm }}>{mock ? `${cert.data ? `Demo credential ID: ${cert.data.credentialId}` : 'Issuing creates a local demo record only.'} No cryptographic verification, accreditation, or institutional issuance is implied.` : cert.data ? `Credential ID: ${cert.data.credentialId}` : 'Issuing records your certificate of completion.'}</Text>
          </Card>
          <DemoLabel text="DEMO milestone · synthetic progress" />
          <Button title="Back to My Learning" variant="outline" onPress={() => navigation.navigate(Routes.StudentMyLearning)} />
        </Stack>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  badge: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.gold100, alignItems: 'center', justifyContent: 'center' },
  seal: { position: 'absolute', right: 2, bottom: 2, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.coral500, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.cream },
  mini: { borderWidth: 2, borderColor: colors.gold500, borderRadius: 12, padding: spacing.md, backgroundColor: colors.gold50 },
});
