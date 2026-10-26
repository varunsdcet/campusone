import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, LoadingState, ErrorState, Icon } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useSection } from './useCourses';
import { useCourseLearning, useCourseLms, useSyllabus } from './useCourseLearning';
import { viewFile } from '../../shared/files';
import { formatBytes, formatDate } from '../../../utils/format';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';

export function LearningObjectivesScreen({ navigation, route }: RootScreenProps<'StudentLearningObjectives'>) {
  const { sectionId } = route.params;
  const mock = isMockMode();
  const section = useSection(sectionId);
  const lms = useCourseLms(sectionId, !mock);
  const syllabus = useSyllabus(sectionId, !mock);
  const cl = useCourseLearning();
  const [downloading, setDownloading] = useState(false);
  const s = section.data;
  const topics = lms.data?.syllabus ?? [];
  const description = mock ? s?.description : syllabus.data?.description || s?.description;
  const download = async () => {
    setDownloading(true);
    try {
      const f = await cl.downloadSyllabus(sectionId);
      await viewFile(f.path, f.mime, f.name);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setDownloading(false);
    }
  };
  return (
    <Screen testID="learning-objectives" header={<ScreenHeader />}>
      {section.isLoading ? <LoadingState /> : !s ? <ErrorState error={section.error} /> : (
        <Stack>
          <Text variant="displayMd" style={{ textTransform: 'uppercase' }}>{s.course.code}: {s.course.title}</Text>
          <Text variant="bodySm">{s.sectionCode}: {formatDate(s.startDate, { dot: true })} - {formatDate(s.endDate, { dot: true })}</Text>
          {s.location ? <Text variant="bodySm">{s.location}</Text> : null}
          <Button title="All course information ›" variant="outline" onPress={() => navigation.navigate(Routes.StudentCourseInfo, { sectionId })} testID="objectives-all-info" />
          <Row gap={spacing.sm}><View style={styles.tile}><Icon name="FileText" size={18} color={colors.green900} /></View><Text variant="titleMd">Learning Objectives</Text></Row>
          {mock ? (
            <Card>
              <Text variant="body">{s.objectives}</Text>
              <Text variant="caption" style={{ marginTop: spacing.md }}>Last modified: Tuesday, 15 September 2026, 6:40 PM (demo)</Text>
            </Card>
          ) : (
            <Card testID="objectives-topics">
              {lms.isLoading ? <LoadingState /> : topics.length ? (
                <Stack gap={spacing.sm}>
                  {topics.map(t => <Text key={t.id} variant={t.level <= 1 ? 'bodyStrong' : 'body'} style={{ paddingLeft: Math.max(0, t.level - 1) * spacing.md }}>{t.title}</Text>)}
                </Stack>
              ) : <Text variant="bodySm">Your instructor has not published learning objectives for this course yet.</Text>}
            </Card>
          )}
          <Row gap={spacing.sm}><View style={styles.tile}><Icon name="BookOpen" size={18} color={colors.green900} /></View><Text variant="titleMd">Brief Course Description</Text></Row>
          <Card><Text variant={description ? 'body' : 'bodySm'}>{description || 'No course description has been published yet.'}</Text></Card>
          {!mock ? (
            <>
              <Row gap={spacing.sm}><View style={styles.tile}><Icon name="FileDown" size={18} color={colors.green900} /></View><Text variant="titleMd">Course Syllabus</Text></Row>
              <Card testID="objectives-syllabus">
                {syllabus.isLoading ? <LoadingState /> : syllabus.data?.available ? (
                  <Stack gap={spacing.sm}>
                    <Text variant="bodyStrong">{syllabus.data.name || 'Syllabus'}</Text>
                    <Text variant="caption">{[syllabus.data.size ? formatBytes(syllabus.data.size) : null, syllabus.data.updatedAt ? `Updated ${formatDate(syllabus.data.updatedAt)}` : null].filter(Boolean).join(' · ')}</Text>
                    <Button title="Download syllabus" onPress={download} loading={downloading} testID="objectives-syllabus-download" />
                  </Stack>
                ) : <Text variant="bodySm">No syllabus has been released to students for this course yet.</Text>}
              </Card>
            </>
          ) : null}
        </Stack>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ tile: { width: 34, height: 34, borderRadius: 8, backgroundColor: colors.info100, alignItems: 'center', justifyContent: 'center' } });
