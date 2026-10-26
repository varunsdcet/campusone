import { activeCourseCount } from '../../src/features/student/courses/useCourses';

describe('student course dashboard count', () => {
  it('matches the active course view while retaining completed courses in history', () => {
    expect(activeCourseCount([{ status: 'In Progress' }, { status: 'Upcoming' }, { status: 'Completed' }])).toBe(2);
    expect(activeCourseCount(undefined)).toBeUndefined();
  });
});
