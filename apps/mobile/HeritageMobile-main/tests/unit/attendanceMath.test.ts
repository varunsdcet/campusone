import { attendanceCounts } from '../../src/features/student/attendance/attendanceMath';

describe('attendance percentage', () => {
  it('counts present and late as attended and excludes excused sessions from the denominator', () => {
    expect(attendanceCounts(['present', 'late', 'absent', 'excused'])).toEqual({
      present: 1,
      absent: 1,
      late: 1,
      excused: 1,
      counted: 3,
      rate: 67,
      onTime: 33.3,
    });
  });

  it('does not produce NaN when every session is excused', () => {
    expect(attendanceCounts(['excused'])).toMatchObject({ counted: 0, rate: 0, onTime: 0 });
  });
});
