import { describe, expect, it } from 'vitest';
import {
  getQualificationExpiryStatus,
  getQualificationExpiryWindow,
} from '@/features/reports/qualification-expiry';

describe('qualification expiry dates', () => {
  it('uses UTC calendar days and includes the 90th day', () => {
    const window = getQualificationExpiryWindow(new Date('2030-01-01T23:30:00-05:00'));
    expect(window).toEqual({ today: '2030-01-02', through: '2030-04-02' });
    expect(getQualificationExpiryStatus(window.today, window.today, window.through)).toBe('Expiring');
    expect(getQualificationExpiryStatus(window.through, window.today, window.through)).toBe('Expiring');
    expect(getQualificationExpiryStatus('2030-04-03', window.today, window.through)).toBeNull();
  });

  it('marks only dates before today as expired', () => {
    expect(getQualificationExpiryStatus('2030-01-01', '2030-01-02', '2030-04-02')).toBe('Expired');
  });
});
