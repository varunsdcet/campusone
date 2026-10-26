import React, { useMemo, useState } from 'react';
import { Linking, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, EmptyState, ErrorState, LoadingState, Pill, Row, Screen, ScreenHeader, Select, Stack, Text } from '../../../components';
import { useServices } from '../../../app/ServicesProvider';
import { spacing } from '../../../theme';
import { formatDate } from '../../../utils/format';

export function AssignedWorkScreen() {
  const services = useServices();
  const [category, setCategory] = useState('all');
  const query = useQuery({
    queryKey: ['instructor-assigned-work'],
    queryFn: () => services.instructor.listAssignedWork!(),
    enabled: Boolean(services.instructor.listAssignedWork),
  });
  const categories = useMemo(() => [...new Set((query.data ?? []).map(item => item.category))], [query.data]);
  const items = (query.data ?? []).filter(item => category === 'all' || item.category === category);

  return (
    <Screen header={<ScreenHeader backLabel="More" />} testID="assigned-work-screen">
      <Stack>
        <Text variant="overline">Your operational queue</Text>
        <Text variant="displayMd">My Assigned Work</Text>
        <Text variant="bodySm">Only records where you are the selected owner, counsellor, advisor, interviewer, instructor, handler, reviewer or assignee appear here.</Text>
        <Card padding={spacing.md}>
          <Select label="Module" value={category} onChange={setCategory} options={[{ value: 'all', label: `All assignments (${query.data?.length ?? 0})` }, ...categories.map(value => ({ value, label: value }))]} />
        </Card>
        {query.isLoading ? <LoadingState /> : query.error ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : !items.length ? (
          <EmptyState icon="ClipboardCheck" title="No assigned work" message={category === 'all' ? 'Nothing is currently assigned to your staff profile.' : `No ${category} records are assigned to you.`} />
        ) : items.map(item => (
          <Card key={`${item.kind}-${item.id}`} testID={`assigned-work-${item.id}`}>
            <Row justify="space-between" align="flex-start">
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <Text variant="overline">{item.category}</Text>
                <Text variant="titleMd">{item.title}</Text>
              </View>
              <Pill label={item.status} tone={/complete|resolved|closed|accepted/i.test(item.status) ? 'green' : /cancel|lost|reject/i.test(item.status) ? 'red' : 'yellow'} small />
            </Row>
            <Text variant="bodySm">{item.subtitle}</Text>
            {item.when ? <Text variant="caption">When · {item.when.includes('–') ? item.when : formatDate(item.when)}</Text> : null}
            {item.location ? <Text variant="caption">Location · {item.location}</Text> : null}
            {item.details.map(detail => <Text key={detail.label} variant="caption">{detail.label} · {detail.value}</Text>)}
            {item.actionUrl ? <Button title="Start Interview" size="sm" onPress={() => Linking.openURL(item.actionUrl!)} testID={`assigned-work-open-${item.id}`} /> : null}
          </Card>
        ))}
      </Stack>
    </Screen>
  );
}
