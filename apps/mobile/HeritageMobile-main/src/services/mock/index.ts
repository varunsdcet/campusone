import type { Services } from '../contracts';
import { MockContext } from './context';
import { createAuthMock } from './authMock';
import { createCatalogueMock, createEnrolmentMock, createLearningMock, createCoachMock } from './learningMock';
import { createCoursesMock, createAssignmentsMock, createGradesMock, createAttendanceMock, createWorkshopsMock } from './academicsMock';
import { createRecordsMock, createTasksMock, createDocumentsMock, createFinanceMock, createRequestsMock, createNotificationsMock, createMailMock, createAskHeritageMock } from './recordsMock';
import { createInstructorMock } from './instructorMock';
import { createPlannerMock } from './plannerMock';

export function createMockServices(ctx: MockContext): Services {
  return {
    auth: createAuthMock(ctx),
    catalogue: createCatalogueMock(ctx),
    enrolment: createEnrolmentMock(ctx),
    learning: createLearningMock(ctx),
    coach: createCoachMock(ctx),
    courses: createCoursesMock(ctx),
    assignments: createAssignmentsMock(ctx),
    grades: createGradesMock(ctx),
    attendance: createAttendanceMock(ctx),
    workshops: createWorkshopsMock(ctx),
    records: createRecordsMock(ctx),
    tasks: createTasksMock(ctx),
    documents: createDocumentsMock(ctx),
    finance: createFinanceMock(ctx),
    requests: createRequestsMock(ctx),
    notifications: createNotificationsMock(ctx),
    mail: createMailMock(ctx),
    askHeritage: createAskHeritageMock(ctx),
    instructor: createInstructorMock(ctx),
    planner: createPlannerMock(),
  };
}
export { scenario } from './simulate';
