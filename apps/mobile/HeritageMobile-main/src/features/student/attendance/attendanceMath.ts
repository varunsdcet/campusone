import type { AttendanceStatus } from '../../../domain/types';

export type AttendanceCounts = {
  present: number;
  absent: number;
  late: number;
  excused: number;
  counted: number;
  rate: number;
  onTime: number;
};

/** Excused sessions are displayed, but do not lower a student's attendance rate. */
export function attendanceCounts(statuses: AttendanceStatus[]): AttendanceCounts {
  const present = statuses.filter(status => status === 'present').length;
  const absent = statuses.filter(status => status === 'absent').length;
  const late = statuses.filter(status => status === 'late').length;
  const excused = statuses.filter(status => status === 'excused').length;
  const counted = present + absent + late;
  const rate = counted ? Math.round(((present + late) / counted) * 100) : 0;
  const onTime = counted ? Math.round((present / counted) * 1000) / 10 : 0;
  return { present, absent, late, excused, counted, rate, onTime };
}
