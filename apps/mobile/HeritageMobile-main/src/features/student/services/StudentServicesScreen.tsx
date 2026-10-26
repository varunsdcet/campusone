import React from 'react';
import { Screen, ScreenHeader, Text, Card, Stack, ListRow, LoadingState, ErrorState, EmptyState, Pill, Row } from '../../../components';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useRequests } from '../records/useRecords';
import { formatDate } from '../../../utils/format';
import { spacing } from '../../../theme';

const requestLabel: Record<string, string> = {
  leave: 'Leave of absence',
  personalDetails: 'Personal details update',
  transcript: 'Official transcript',
  specialLetter: 'Verification letter',
  englishTest: 'English test registration',
  attendanceCorrection: 'Attendance correction',
};

export function StudentServicesScreen({ navigation }: RootScreenProps<'StudentServices'>) {
  const requests = useRequests();
  const list = requests.data ?? [];

  return (
    <Screen
      testID="student-services"
      header={<ScreenHeader title="Student Services" />}
      refreshing={requests.isRefetching}
      onRefresh={() => requests.refetch()}
    >
      <Stack>
        <Text variant="body">Submit a request or track its review status without leaving the app.</Text>
        <Card padding={spacing.md}>
          <Text variant="overline" style={{ marginBottom: 4 }}>New request</Text>
          <ListRow icon="CalendarOff" title="Leave of Absence" subtitle="Request dates and track registrar review" onPress={() => navigation.navigate(Routes.StudentLeave)} testID="services-leave" />
          <ListRow icon="FileText" title="Transcript or verification letter" subtitle="Request official student documents" onPress={() => navigation.navigate(Routes.StudentDocuments)} testID="services-documents" />
          <ListRow icon="UserPen" title="Update Personal Details" subtitle="Submit contact or identity corrections" onPress={() => navigation.navigate(Routes.StudentPersonalDetails)} testID="services-personal-details" />
          <ListRow icon="Languages" title="English Test" subtitle="Register and review test requests" onPress={() => navigation.navigate(Routes.StudentEnglishTest)} testID="services-english-test" />
        </Card>

        <Text variant="overline">Your requests</Text>
        {requests.isLoading ? <LoadingState /> : requests.error ? <ErrorState error={requests.error} onRetry={() => requests.refetch()} /> : !list.length ? (
          <EmptyState icon="ClipboardList" title="No service requests" message="Requests submitted from the options above will appear here." />
        ) : list.map(request => (
          <Card key={request.id} padding={spacing.md} testID={`service-request-${request.id}`}>
            <ListRow
              icon="ClipboardList"
              title={requestLabel[request.kind] ?? request.summary}
              subtitle={`${request.summary} · ${formatDate(request.createdAt)}`}
              right={<Row><Pill label={request.status} tone={request.status === 'pending' ? 'coral' : request.status === 'approved' ? 'green' : 'grey'} small dot /></Row>}
              onPress={() => navigation.navigate(Routes.StudentRequestDetails, { requestId: request.id })}
            />
          </Card>
        ))}
      </Stack>
    </Screen>
  );
}
