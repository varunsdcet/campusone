import type { Services } from '../contracts';
import type { Repository } from '../../storage/repository';
import type { KeyValueStore } from '../../storage/asyncStorage';
import { useSessionStore } from '../../state/sessionStore';
import { ApiClient } from './client';
import { createAuthApi } from './auth';
import { createAcademicsApi } from './academics';
import { createRecordsApi } from './records';
import { createLearningApi } from './learning';
import { createInstructorApi } from './instructor';
import { createCourseLearningApi } from './courseLearning';
import { createFeePaymentsApi } from './feePayments';
import { createPublicFlowsApi } from './publicFlows';
import { createApplicantApi } from './applicant';
import { createPlannerApi } from './planner';

/** Live Heritage API adapter (https://myvccbc.com/__api). */
export function createApiServices(opts: { repo: Repository; store: KeyValueStore }): Services {
  const api = new ApiClient(opts.store);
  const role = () => useSessionStore.getState().user?.role ?? null;

  const instructor = createInstructorApi(api);
  const academics = createAcademicsApi(api, role, () => instructor.core);
  const records = createRecordsApi(api, role);
  const learning = createLearningApi(api, opts.repo, opts.store);

  const resetCaches = () => {
    instructor.invalidate();
    academics.invalidate();
    records.invalidate();
    learning.invalidate();
  };

  api.setUnauthorizedHandler(() => {
    resetCaches();
    api.clearSession().catch(() => undefined);
    if (useSessionStore.getState().status === 'signedIn') useSessionStore.getState().setSignedOut();
  });

  const auth = createAuthApi(api, opts.store);
  const authWithReset: Services['auth'] = {
    ...auth,
    async login(input) {
      resetCaches();
      return auth.login(input);
    },
    async logout() {
      resetCaches();
      return auth.logout();
    },
  };

  return {
    auth: authWithReset,
    catalogue: learning.catalogue,
    enrolment: learning.enrolment,
    learning: learning.learning,
    coach: learning.coach,
    courses: academics.courses,
    assignments: academics.assignments,
    grades: academics.grades,
    attendance: academics.attendance,
    workshops: academics.workshops,
    records: records.records,
    tasks: records.tasks,
    documents: records.documents,
    finance: records.finance,
    requests: records.requests,
    notifications: records.notifications,
    mail: records.mail,
    askHeritage: records.askHeritage,
    instructor: instructor.service,
    ...createCourseLearningApi(api),
    ...createFeePaymentsApi(api, () => records.invalidate()),
    ...createPublicFlowsApi(api),
    ...createApplicantApi(api),
    planner: createPlannerApi(api, opts.store),
  };
}
