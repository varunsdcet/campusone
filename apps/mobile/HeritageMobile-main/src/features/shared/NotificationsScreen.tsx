import React, { useState } from 'react';
import { FlatList, StyleSheet, View, Pressable } from 'react-native';
import { Screen, ScreenHeader, Text, Row, Stack, Button, Pill, LoadingState, ErrorState, EmptyState, Icon, ChipRow } from '../../components';
import { colors, spacing } from '../../theme';
import type { RootScreenProps } from '../../navigation/types';
import { useNotifications } from './useShared';
import { formatDateTime } from '../../utils/format';
import type { Notification } from '../../domain/types';
import { navigateTo } from '../../navigation/hooks';
import { useSettings } from '../auth/useAuth';

const ICONS: Record<Notification['icon'], { name: 'Video' | 'TriangleAlert' | 'GraduationCap' | 'Users' | 'CalendarClock' | 'Info'; bg: string; fg: string }> = {
  video: { name: 'Video', bg: colors.green50, fg: colors.green900 },
  warning: { name: 'TriangleAlert', bg: colors.gold100, fg: colors.gold600 },
  grade: { name: 'GraduationCap', bg: colors.green50, fg: colors.green900 },
  workshop: { name: 'Users', bg: colors.coral50, fg: colors.coral600 },
  schedule: { name: 'CalendarClock', bg: colors.info100, fg: colors.info600 },
  info: { name: 'Info', bg: colors.surfaceMuted, fg: colors.inkSecondary },
};

export function NotificationsScreen({ navigation }: RootScreenProps<'Notifications'>) {
  const { list, markRead, markAllRead } = useNotifications();
  const settings = useSettings();
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const data = list.data ?? [];
  const unread = data.filter(n => !n.read).length;
  const shown = data.filter(n => filter === 'all' || (filter === 'unread' ? !n.read : n.read));
  const open = (n: Notification) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.link) navigateTo(navigation, n.link.route, n.link.params);
  };
  return (
    <Screen scroll={false} padded={false} testID="notifications-screen" header={<ScreenHeader backLabel="Back" actions={[{ label: 'Mark all read', icon: 'Check', accessibilityLabel: 'Mark all as read', onPress: () => markAllRead.mutate(), testID: 'notif-mark-all' }]} />}>
      {list.isLoading ? <LoadingState /> : list.error ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (
        <FlatList data={shown} keyExtractor={n => n.id} contentContainerStyle={styles.list} ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListHeaderComponent={<Stack gap={spacing.sm} style={{ marginBottom: spacing.sm }}>
            <Row justify="space-between"><Text variant="displayLg">Notifications</Text>{unread ? <Pill label={`${unread} Unread`} tone="coral" small /> : null}</Row>
            <Text variant="bodySm">{data.length} notifications total · Showing recent activity</Text>
            <ChipRow options={[{ value: 'all', label: 'All', count: data.length }, { value: 'unread', label: 'Unread •', count: unread }, { value: 'read', label: 'Read', count: data.length - unread }]} value={filter} onChange={setFilter} testID="notif-filter" />
          </Stack>}
          ListEmptyComponent={<EmptyState icon="BellOff" title={filter === 'unread' ? 'No unread notifications' : 'No notifications'} />}
          renderItem={({ item: n }) => {
            const ic = ICONS[n.icon];
            return (
              <Pressable testID={`notif-${n.id}`} accessibilityRole="button" accessibilityLabel={`${n.read ? 'Read' : 'Unread'}: ${n.title}`} onPress={() => open(n)} style={[styles.card, !n.read ? styles.unread : null]}>
                {!n.read ? <View style={styles.dotTR} /> : null}
                <Row gap={spacing.md} align="flex-start">
                  <View style={[styles.tile, { backgroundColor: ic.bg }]}><Icon name={ic.name} size={20} color={ic.fg} /></View>
                  <View style={{ flex: 1 }}>
                    <Row justify="space-between"><Text variant="bodyStrong" style={{ flex: 1 }}>{!n.read ? '• ' : ''}{n.title}</Text>{n.read ? <Row gap={2}><Icon name="Check" size={12} color={colors.success600} /><Text variant="caption">Read</Text></Row> : null}</Row>
                    <Text variant="bodySm" numberOfLines={2}>{n.body}</Text>
                    <View style={styles.divider} />
                    <Row justify="space-between"><Text variant="caption">{formatDateTime(n.createdAt, settings.data?.timeZone)}</Text>{n.read ? <Text variant="label" color={colors.green900}>{n.category}</Text> : <Button title="Mark read" variant="outline" size="sm" fullWidth={false} onPress={() => markRead.mutate(n.id)} testID={`notif-read-${n.id}`} />}</Row>
                  </View>
                </Row>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  unread: { backgroundColor: colors.coral50, borderColor: colors.coral100 },
  dotTR: { position: 'absolute', top: -4, right: -4, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.coral500 },
  tile: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
});
