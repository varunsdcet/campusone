import type { Services } from '../contracts';
import { createNotConfiguredService } from './notConfigured';
import { createHttpClient } from './httpClient';

/**
 * HTTP adapter skeleton. Every method currently returns a typed NOT_CONFIGURED
 * error. Wire real endpoints with `withHttpMethods` as they become available.
 */
export function createHttpServices(getToken: () => string | undefined): Services {
  // The client is created so future overrides can close over it.
  void createHttpClient(getToken);
  return {
    auth: createNotConfiguredService('auth'),
    catalogue: createNotConfiguredService('catalogue'),
    enrolment: createNotConfiguredService('enrolment'),
    learning: createNotConfiguredService('learning'),
    coach: createNotConfiguredService('coach'),
    courses: createNotConfiguredService('courses'),
    assignments: createNotConfiguredService('assignments'),
    grades: createNotConfiguredService('grades'),
    attendance: createNotConfiguredService('attendance'),
    workshops: createNotConfiguredService('workshops'),
    records: createNotConfiguredService('records'),
    tasks: createNotConfiguredService('tasks'),
    documents: createNotConfiguredService('documents'),
    finance: createNotConfiguredService('finance'),
    requests: createNotConfiguredService('requests'),
    notifications: createNotConfiguredService('notifications'),
    mail: createNotConfiguredService('mail'),
    askHeritage: createNotConfiguredService('askHeritage'),
    instructor: createNotConfiguredService('instructor'),
    planner: createNotConfiguredService('planner'),
  };
}
