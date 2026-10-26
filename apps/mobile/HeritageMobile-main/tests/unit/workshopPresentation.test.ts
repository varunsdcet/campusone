import type { WorkshopWithStatus } from '../../src/services/contracts/academics';
import { clock } from '../../src/utils/clock';
import { workshopBanner, workshopDisplayTitle, workshopScheduleLabel } from '../../src/features/student/workshops/workshopPresentation';

const workshop: WorkshopWithStatus = {
  id: 'ws-1', code: 'OSH-1791450708', title: 'OSH-1791450708 · Open Study Hall 1791450708', category: 'Workshop',
  description: '', date: '2026-10-11', endDate: '2026-11-18', startTime: '16:00', durationHours: 2,
  ceu: 0, mode: 'In person', location: 'Room 201', capacity: 30, instructor: '', requiresApproval: false,
  agenda: [], materials: [], joinUrlLabel: '', registeredCount: 1,
};

afterEach(() => clock.reset());

describe('workshop presentation', () => {
  it('shows a multi-day workshop as in progress instead of a negative countdown', () => {
    clock.setOffsetMs(new Date('2026-10-16T10:00:00').getTime() - Date.now());
    expect(workshopBanner(workshop)).toEqual({ title: 'Workshop in progress', text: 'Runs through Nov 18, 2026', tone: 'green' });
  });

  it('uses friendly today and tomorrow countdown labels', () => {
    clock.setOffsetMs(new Date('2026-10-10T10:00:00').getTime() - Date.now());
    expect(workshopBanner(workshop).title).toBe('Session starts tomorrow');
    clock.setOffsetMs(new Date('2026-10-11T10:00:00').getTime() - Date.now());
    expect(workshopBanner(workshop).title).toBe('Session starts today');
  });

  it('removes a duplicated code from the title and formats the schedule', () => {
    expect(workshopDisplayTitle(workshop)).toBe('Open Study Hall');
    expect(workshopScheduleLabel(workshop)).toBe('In person · 4:00 PM');
  });
});
