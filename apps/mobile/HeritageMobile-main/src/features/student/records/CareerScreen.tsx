import React from 'react';
import { View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, EmptyState } from '../../../components';
import { spacing } from '../../../theme';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useCareer } from './useRecords';
import { formatDate } from '../../../utils/format';
import { useFileActions } from '../../shared/useFileActions';
import { webUrl } from '../../../services/api/util';

/** Career services & opportunities (GET /student/career). */
export function CareerScreen({ navigation }: RootScreenProps<'StudentCareer'>) {
  const career = useCareer();
  const files = useFileActions();
  /** Opens the native screen for a Heritage web path, falling back to the website. */
  const open = (href?: string) => {
    const h = (href ?? '').toLowerCase();
    if (h.includes('message')) navigation.navigate(Routes.StudentTabs, { screen: Routes.StudentMessagesTab });
    else if (h.includes('practicum')) navigation.navigate(Routes.StudentProgramPlan);
    else if (h.includes('/ask')) navigation.navigate(Routes.AskHeritage);
    else {
      const url = webUrl(href);
      if (url) void files.openUrl(url);
    }
  };
  const d = career.data;
  return (
    <Screen testID="career-screen" header={<ScreenHeader backLabel="Back" />}>
      <Stack>
        <Text variant="displayLg">Career Services</Text>
        <Text variant="body">Co-op, placement and job opportunities matched to your program, plus career support.</Text>
        {!career.supported ? <EmptyState icon="BriefcaseBusiness" title="Career services are not available" /> : career.isLoading ? <LoadingState /> : career.error || !d ? <ErrorState error={career.error} onRetry={() => career.refetch()} /> : (
          <>
            <Text variant="overline">Opportunities ({d.opportunities.length})</Text>
            {!d.opportunities.length ? <EmptyState icon="BriefcaseBusiness" title="No open opportunities" message="New postings for your program will appear here." /> : d.opportunities.map(o => (
              <Card key={o.id} testID={`career-${o.id}`}>
                <Row justify="space-between" align="flex-start"><Text variant="titleMd" style={{ flex: 1 }}>{o.title}</Text><Pill label={o.status === 'open' ? 'Open' : o.status} tone={o.status === 'open' ? 'green' : 'grey'} small /></Row>
                <Text variant="bodySm">{o.employerName}</Text>
                {o.skills.length ? <Row wrap gap={6} style={{ marginTop: spacing.sm }}>{o.skills.map(s => <Pill key={s} label={s} tone="grey" small />)}</Row> : null}
                <Row justify="space-between" style={{ marginTop: spacing.sm }}>
                  <Text variant="caption">Updated {formatDate(o.updatedAt)}</Text>
                  {o.href ? <Button title="Learn more →" variant="outline" size="sm" fullWidth={false} onPress={() => open(o.href)} /> : null}
                </Row>
              </Card>
            ))}
            {d.services.length ? <Text variant="overline">Support</Text> : null}
            {d.services.map(s => (
              <Card key={s.title} tone="muted">
                <View style={{ gap: 4 }}>
                  <Text variant="titleSm">{s.title}</Text>
                  <Text variant="bodySm">{s.body}</Text>
                </View>
                {s.href ? <Button title={s.cta} variant="outline" size="sm" fullWidth={false} style={{ marginTop: spacing.sm }} onPress={() => open(s.href)} /> : null}
              </Card>
            ))}
          </>
        )}
      </Stack>
    </Screen>
  );
}
