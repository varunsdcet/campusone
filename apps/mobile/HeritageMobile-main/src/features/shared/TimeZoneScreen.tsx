import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, Icon, Select, InfoBanner, LoadingState, ErrorState, DemoLabel } from '../../components';
import { colors, spacing } from '../../theme';
import { isMockMode } from '../../config/appConfig';
import type { RootScreenProps } from '../../navigation/types';
import { useSettings, useUpdateSettings } from '../auth/useAuth';
import { TIME_ZONES, tzLabel, tzAbbr, tzOffsetMinutes } from '../../utils/timezone';
import { formatTime, formatLongWeekdayDate, formatDateTime } from '../../utils/format';
import { useSessionStore } from '../../state/sessionStore';
import { toast } from '../../state/uiStore';
import { errorMessage } from '../../services/errors';
import { Routes } from '../../navigation/routes';

/** Shared time-zone screen (student + instructor). IANA zones; offsets computed per instant. */
export function TimeZoneScreen({ navigation }: RootScreenProps<'TimeZone'>) {
  const settings = useSettings();
  const update = useUpdateSettings();
  const role = useSessionStore(s => s.user?.role);
  // This screen promises the current local time, so it must use the device
  // clock rather than the accelerated fixture clock used by demo coursework.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const [pending, setPending] = useState<string | null>(null);
  const current = settings.data?.timeZone ?? 'America/Vancouver';
  const target = pending ?? current;
  const d = new Date(now);
  const shift = tzOffsetMinutes(target, d) - tzOffsetMinutes(current, d);
  const sampleDeadline = new Date(now + 24 * 60 * 60 * 1000).toISOString();
  const shiftHours = Math.round((shift / 60) * 10) / 10;
  const targetName = TIME_ZONES.find(z => z.id === target)?.label ?? target;
  const save = async () => {
    try {
      await update.mutateAsync({ timeZone: target });
      toast('Time zone saved', 'success');
      setPending(null);
    } catch (e) { toast(errorMessage(e), 'error'); }
  };
  return (
    <Screen testID="timezone-screen" header={<ScreenHeader title="Time Zone" actions={role === 'student' ? [{ label: 'Help', accessibilityLabel: 'Help', onPress: () => navigation.navigate(Routes.StudentSupport) }] : []} />} footer={<Stack gap={4}><Button title="Save Time Zone" icon={<Icon name="Check" size={16} color={colors.white} />} onPress={save} loading={update.isPending} disabled={target === current} disabledReason="Select a different time zone to save" testID="tz-save" /><Text variant="caption" align="center">Changes take effect immediately across schedules and deadlines.</Text></Stack>}>
      {settings.isLoading ? <LoadingState /> : settings.error ? <ErrorState error={settings.error} onRetry={() => settings.refetch()} /> : (
        <Stack>
          <Text variant="titleLg">Change Your Time Zone</Text>
          <Text variant="body">All course times, deadlines and schedules will display in the zone you save.</Text>
          <Card style={styles.timeCard}>
            <Row justify="space-between" align="flex-start">
              <Row gap={6} style={styles.flex}><Icon name="Clock" size={17} color={colors.coral600} /><Text variant="overline" color={colors.green900}>Current time</Text></Row>
              <Pill label="Active" tone="coral" small />
            </Row>
            <Text variant="displayMd" style={styles.timeText} numberOfLines={1} adjustsFontSizeToFit>{formatTime(d, current, true)}</Text>
            <Text variant="bodySm">{formatLongWeekdayDate(d, current)}</Text>
            <View style={styles.divider} />
            <Row justify="space-between" align="flex-start">
              <Row gap={7} align="flex-start" style={styles.flex}><View style={styles.greenDot} /><View style={styles.flex}><Text variant="bodyStrong">{TIME_ZONES.find(z => z.id === current)?.label ?? current}</Text><Text variant="caption">{tzLabel(current, d).match(/^\([^)]*\)/)?.[0]} · {current}</Text></View></Row>
              <Pill label={tzAbbr(current, d)} tone="grey" small />
            </Row>
          </Card>
          <Select label="New Time Zone" required leftIcon="Globe" value={target} onChange={setPending} options={TIME_ZONES.map(z => ({ value: z.id, label: tzLabel(z.id, d), description: z.id }))} testID="tz-select" sheetTitle="Select time zone (IANA)" />
          <Card tone={target === current ? 'muted' : undefined} testID="tz-preview">
            <Row justify="space-between" align="flex-start"><Row gap={6} style={styles.flex}><Icon name="Timer" size={17} color={colors.green900} /><Text variant="overline">Preview</Text></Row><Pill label={tzAbbr(target, d)} tone="green" small /></Row>
            <Text variant="displayMd" style={styles.timeText} numberOfLines={1} adjustsFontSizeToFit>{formatTime(d, target, true)}</Text>
            <Text variant="bodySm">{formatLongWeekdayDate(d, target)}</Text>
            <Text variant="caption" style={styles.zoneName}>{targetName} · {target}</Text>
          </Card>
          <InfoBanner
            tone={shift === 0 ? 'green' : 'gold'}
            icon="CalendarSync"
            title={shift === 0 ? 'Schedule stays unchanged' : `${shiftHours > 0 ? '+' : ''}${shiftHours} hours from your current display`}
            text={shift === 0 ? 'You are previewing the time zone already saved on your account.' : `Example: ${formatDateTime(sampleDeadline, current)} will display as ${formatDateTime(sampleDeadline, target)}. It remains the same deadline instant.`}
          />
          <Card tone="muted"><Row gap={8} align="flex-start"><Icon name="BookOpen" size={16} color={colors.green900} /><Text variant="caption" style={styles.flex}>Changing the display zone does not extend or shorten a deadline{isMockMode() ? ' (demo data)' : ''}.</Text></Row></Card>
          <DemoLabel text="Device clock · IANA time zones · daylight-saving aware" />
        </Stack>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  timeCard: { overflow: 'hidden' },
  timeText: { marginTop: spacing.xs, fontVariant: ['tabular-nums'] },
  zoneName: { marginTop: spacing.xs },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success600, marginTop: 6 },
});
