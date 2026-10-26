import React, { useState } from 'react';
import { Linking, Modal, Pressable, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, Icon, ProgressBar, RadioRow, DemoLabel } from '../../../components';
import { colors, spacing } from '../../../theme';
import { appConfig, isMockMode } from '../../../config/appConfig';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useProgramme } from '../catalogue/useCatalogue';
import { useSnapshot, useCertificate } from './useLearning';
import { useCurrentUser } from '../../../state/sessionStore';
import { useFileActions } from '../../shared/useFileActions';
import { formatDate } from '../../../utils/format';
import { toast } from '../../../state/uiStore';
import { Logo } from '../../auth/Brand';
import { ACTIVITY_ROUTE } from './activityMeta';

export function CertificateScreen({ navigation, route }: RootScreenProps<'StudentCertificate'>) {
  const { programmeId } = route.params;
  const user = useCurrentUser();
  const programme = useProgramme(programmeId);
  const snap = useSnapshot(programmeId);
  const cert = useCertificate(programmeId);
  const files = useFileActions();
  const [zoom, setZoom] = useState(false);
  const insets = useSafeAreaInsets();
  const p = programme.data;
  const s = snap.data;
  const unlocked = !!cert.data;
  const mock = isMockMode();
  const verifyUrl = unlocked && appConfig.webOrigin ? `${appConfig.webOrigin}/verify/${encodeURIComponent(cert.data!.id)}` : undefined;
  const share = () => (mock ? files.download('certificate', `certificate-${programmeId}-DEMO.pdf`) : verifyUrl ? Share.share({ message: `${p?.title ?? 'Certificate'} — Campus One certificate of completion: ${verifyUrl}` }).catch(() => undefined) : undefined);
  const next = s?.nextActivityId ? p?.chapters.flatMap(c => c.activities).find(a => a.id === s.nextActivityId) : undefined;
  const preview = (large: boolean) => (
    <View style={[styles.cert, large ? styles.certLarge : null]}>
      <View style={styles.certInner}>
        <Logo size={large ? 56 : 36} />
        <Text variant="overline" color={colors.green900} style={{ marginTop: 6 }}>Campus One</Text>
        <Text variant={large ? 'displayMd' : 'displaySm'} align="center" style={{ marginTop: 4 }}>Certificate of Completion</Text>
        <Text variant="caption" align="center">This certificate is proudly presented to</Text>
        <Text variant={large ? 'displaySm' : 'titleMd'} align="center" style={{ marginVertical: 4 }}>{user.displayName}</Text>
        <Text variant="caption" align="center">for successfully completing the course</Text>
        <Text variant="bodyStrong" align="center">{p?.title}</Text>
        {mock ? <Text variant="caption" align="center" color={colors.gold600} style={{ marginTop: 6 }}>DEMO / NOT AN OFFICIAL CREDENTIAL</Text> : null}
        <Row justify="space-between" style={{ marginTop: spacing.md, width: '100%' }}>
          <View><Text variant="overline">Date</Text><Text variant="caption">{unlocked ? formatDate(cert.data!.issuedAt) : '—'}</Text></View>
          <View><Text variant="overline">Signature</Text><Text variant="caption">{mock ? 'Demo signature' : 'Authorised signature'}</Text></View>
        </Row>
        {!unlocked ? <View style={styles.watermark} pointerEvents="none"><Text variant="displayLg" color={colors.coral500} style={{ opacity: 0.25, transform: [{ rotate: '-18deg' }] }}>LOCKED</Text></View> : null}
      </View>
    </View>
  );
  return (
    <Screen testID="certificate-screen" header={<ScreenHeader backLabel="Courses" onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate(Routes.StudentMyLearning))} actions={unlocked && (mock || verifyUrl) ? [{ icon: 'Share2', accessibilityLabel: 'Share certificate', onPress: () => { void share(); }, testID: 'cert-share' }] : []} />} footer={!unlocked && next ? (
      <Stack gap={4}>
        <Text variant="caption">Current activity: {next.title}</Text>
        <Button title="Continue course →" variant="coral" onPress={() => navigation.navigate(ACTIVITY_ROUTE[next.type], { programmeId, activityId: next.id })} testID="cert-continue" />
      </Stack>
    ) : undefined}>
      {programme.isLoading || snap.isLoading ? <LoadingState /> : !p || !s ? <ErrorState error={programme.error ?? snap.error} /> : (
        <Stack>
          <Text variant="overline" color={colors.coral600}>Your certificate</Text>
          <Text variant="displayMd">{unlocked ? (mock ? 'Certificate (demo)' : 'Certificate') : `Preview — ${s.percent}% complete`}</Text>
          <Text variant="bodySm">{mock ? (unlocked ? 'Your demo certificate is unlocked. Download or share the sample PDF.' : 'Finish every activity and pass each chapter assessment to unlock the sample certificate.') : unlocked ? 'Your certificate is unlocked. Share or verify it online.' : 'Finish every activity and pass each chapter assessment to unlock the certificate.'}</Text>
          <ProgressBar value={s.percent} color={colors.gold500} />
          <Row gap={6}><Icon name={unlocked ? 'LockOpen' : 'Lock'} size={14} color={colors.inkMuted} /><Text variant="caption">{s.percent}% Completed · {s.completedCount} / {s.totalCount} activities</Text></Row>
          <Card>
            <Row justify="space-between" style={{ marginBottom: spacing.sm }}><Pill label={unlocked ? (mock ? 'Unlocked · DEMO' : 'Unlocked') : 'Preview only · Locked'} tone={unlocked ? 'green' : 'grey'} small /><Text variant="caption">Auto-generated</Text></Row>
            <Pressable accessibilityRole="button" accessibilityLabel="View larger certificate preview" onPress={() => setZoom(true)} testID="cert-zoom">{preview(false)}</Pressable>
            <Row gap={6} style={{ alignSelf: 'center', marginTop: spacing.sm }}><Icon name="ZoomIn" size={14} color={colors.inkMuted} /><Text variant="caption">Tap to view high-resolution certificate preview</Text></Row>
          </Card>
          <Card>
            <Row justify="space-between" style={{ marginBottom: spacing.sm }}><Text variant="titleSm">Certificate unlock requirements</Text><Pill label={unlocked ? 'Met' : 'Locked'} tone={unlocked ? 'green' : 'grey'} small /></Row>
            <Stack gap={spacing.sm}>
              <RadioRow selected={s.completedCount >= s.totalCount} onPress={() => undefined} label="Complete all course activities" description={`${s.completedCount} of ${s.totalCount}`} />
              <RadioRow selected={s.chaptersPassed >= p.chapterCount} onPress={() => undefined} label="Pass chapter assessments" description={`${s.chaptersPassed} of ${p.chapterCount}`} />
              <RadioRow selected={unlocked} onPress={() => undefined} label={`Complete ${p.title}`} description={unlocked ? `${mock ? 'Demo credential' : 'Credential'} ${cert.data!.credentialId}` : 'Final capstone review pending'} />
            </Stack>
            <Row style={{ marginTop: spacing.md }}>
              {mock ? <Button title={unlocked ? 'Download / Print' : 'Print (Locked)'} variant="outline" style={{ flex: 1 }} disabled={!unlocked} disabledReason={unlocked ? undefined : 'Unlocks on completion'} loading={files.busy === 'download:certificate'} onPress={() => files.download('certificate', `certificate-${programmeId}-DEMO.pdf`)} testID="cert-download" /> : null}
              <Button title="Verify Credential" variant="outline" style={{ flex: 1 }} disabled={mock || !verifyUrl} disabledReason={mock ? 'No verification service exists in this demo' : 'Unlocks on completion'} onPress={() => verifyUrl && Linking.openURL(verifyUrl).catch(() => toast('Could not open the verification page.', 'error'))} testID="cert-verify" />
            </Row>
          </Card>
          {!unlocked && s.completedAll ? <Button title={mock ? 'Issue demo certificate' : 'Issue certificate'} variant="coral" onPress={() => navigation.navigate(Routes.StudentCourseComplete, { programmeId })} testID="cert-issue" /> : null}
          <DemoLabel text="DEMO · NOT AN OFFICIAL CREDENTIAL" />
        </Stack>
      )}
      <Modal visible={zoom} animationType="fade" onRequestClose={() => setZoom(false)}>
        <View style={[styles.zoom, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close preview" onPress={() => setZoom(false)} style={styles.close} testID="cert-zoom-close"><Icon name="X" color={colors.white} /></Pressable>
          {preview(true)}
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cert: { borderWidth: 3, borderColor: colors.gold500, borderRadius: 10, padding: 6, backgroundColor: colors.cream },
  certLarge: { width: '92%' },
  certInner: { borderWidth: 1, borderColor: colors.gold500, borderRadius: 6, padding: spacing.md, alignItems: 'center', overflow: 'hidden' },
  watermark: { ...StyleSheet.absoluteFill as object, alignItems: 'center', justifyContent: 'center' },
  zoom: { flex: 1, backgroundColor: colors.green900, alignItems: 'center', justifyContent: 'center' },
  close: { position: 'absolute', top: 54, right: 16, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
