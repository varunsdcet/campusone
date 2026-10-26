import { tzOffsetMinutes, formatOffset, tzLabel } from '../../src/utils/timezone';
import { formatDateTime, formatMoney, formatMoneyParen, formatCountdown, pct, formatDate } from '../../src/utils/format';
import { progressionPolicy } from '../../src/config/progressionPolicy';
import { appConfig } from '../../src/config/appConfig';

describe('time zones (IANA, DST-aware)', () => {
  it('computes different offsets for Vancouver in summer vs winter', () => {
    expect(tzOffsetMinutes('America/Vancouver', new Date('2026-07-01T12:00:00Z'))).toBe(-420);
    expect(tzOffsetMinutes('America/Vancouver', new Date('2026-01-01T12:00:00Z'))).toBe(-480);
    expect(formatOffset(-420)).toBe('UTC-07:00');
    expect(tzLabel('America/Toronto', new Date('2026-09-25T12:00:00Z'))).toContain('(UTC-04:00) Eastern');
  });
  it('preserves the deadline instant while changing display zone', () => {
    const iso = '2026-10-03T05:29:00-07:00';
    expect(formatDateTime(iso, 'America/Vancouver')).toBe('3 Oct 2026, 05:29');
    expect(formatDateTime(iso, 'America/Toronto')).toBe('3 Oct 2026, 08:29');
    expect(formatDateTime(iso, 'Asia/Kolkata')).toBe('3 Oct 2026, 17:59');
  });
});

describe('format helpers', () => {
  it('formats money and counters', () => {
    expect(formatMoney(9500)).toBe('$9,500.00 CAD');
    expect(formatMoneyParen(-3228)).toBe('($3,228.00)');
    expect(formatCountdown(85)).toBe('1:25');
    expect(pct(1, 70)).toBe(1);
    expect(formatDate('2026-09-14', { dot: true })).toBe('Sep. 14, 2026');
  });
});

describe('configuration', () => {
  it('validated config defaults to mock mode with a 10 MiB attachment limit', () => {
    expect(appConfig.mode).toBe('mock');
    expect(appConfig.demo.attachmentMaxBytes).toBe(10 * 1024 * 1024);
    expect(progressionPolicy.passMark.matching).toBe(80);
  });
});
